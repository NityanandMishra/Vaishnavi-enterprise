"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import {
  attributeInputSchema,
  attributeValueInputSchema,
  formatAttributeZodErrors,
} from "@/lib/validations/attribute";

async function requireCatalogManager() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = ((user as any)?.role || "ADMIN") as string;
  if (!session || !user || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    throw new Error("Unauthorized: Requires Admin or Catalog Manager role.");
  }
  return {
    id: ((user as any).id || "admin") as string,
    name: (user.name || "Admin") as string,
    role,
  };
}

// ─── ATTRIBUTES QUERY & CRUD ────────────────────────────────────────────────

export interface GetAttributesParams {
  search?: string;
  type?: string;
  isVariantDefining?: string; // "true" | "false" | "all"
  isActive?: string; // "true" | "false" | "all"
  page?: number;
  limit?: number;
}

export async function getAttributes(params: GetAttributesParams = {}) {
  await requireCatalogManager();

  const {
    search = "",
    type,
    isVariantDefining,
    isActive,
    page = 1,
    limit = 50,
  } = params;

  const where: any = {
    deletedAt: null,
  };

  if (search.trim()) {
    const term = search.trim().toLowerCase();
    where.OR = [
      { name: { contains: term } },
      { code: { contains: term } },
      { description: { contains: term } },
    ];
  }

  if (type && type !== "ALL") {
    where.inputType = type;
  }

  if (isVariantDefining && isVariantDefining !== "all") {
    where.isVariantDefining = isVariantDefining === "true";
  }

  if (isActive && isActive !== "all") {
    where.isActive = isActive === "true";
  }

  const [total, attributes] = await Promise.all([
    prisma.attribute.count({ where }),
    prisma.attribute.findMany({
      where,
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
          take: 6, // for swatch preview dots
        },
        _count: {
          select: {
            values: { where: { deletedAt: null } },
            categoryAttributes: true,
            productValues: true,
            variantValues: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Aggregate total unique product usage (productValues + variantValues -> product)
  const formatted = attributes.map((attr) => {
    const directProductCount = attr._count.productValues;
    const variantUsageCount = attr._count.variantValues;
    const totalProductCount = Math.max(directProductCount, variantUsageCount);

    return {
      id: attr.id,
      name: attr.name,
      code: attr.code,
      inputType: attr.inputType,
      isVariantDefining: attr.isVariantDefining,
      description: attr.description,
      usesSwatches: attr.usesSwatches,
      isActive: attr.isActive,
      valuesCount: attr._count.values,
      categoriesCount: attr._count.categoryAttributes,
      productsCount: totalProductCount,
      previewValues: attr.values.map((v) => ({
        id: v.id,
        label: v.label,
        code: v.code,
        swatchHex: v.swatchHex,
        swatchImageUrl: v.swatchImageUrl,
      })),
      createdAt: attr.createdAt,
      updatedAt: attr.updatedAt,
    };
  });

  return {
    ok: true,
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAttributeById(id: string) {
  await requireCatalogManager();

  const attribute = await prisma.attribute.findUnique({
    where: { id },
    include: {
      values: {
        where: { deletedAt: null },
        orderBy: { displayOrder: "asc" },
        include: {
          _count: {
            select: { variantAttributeValues: true },
          },
        },
      },
      categoryAttributes: {
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      _count: {
        select: {
          productValues: true,
          variantValues: true,
        },
      },
    },
  });

  if (!attribute || attribute.deletedAt) {
    return { ok: false, error: "Attribute not found" };
  }

  return {
    ok: true,
    data: {
      ...attribute,
      values: attribute.values.map((v) => ({
        id: v.id,
        label: v.label,
        code: v.code,
        swatchHex: v.swatchHex,
        swatchImageUrl: v.swatchImageUrl,
        displayOrder: v.displayOrder,
        isActive: v.isActive,
        variantCount: v._count.variantAttributeValues,
      })),
      categories: attribute.categoryAttributes.map((ca) => ({
        id: ca.category.id,
        name: ca.category.name,
        slug: ca.category.slug,
        isRequired: ca.isRequired,
      })),
      productsCount: Math.max(attribute._count.productValues, attribute._count.variantValues),
    },
  };
}

export async function createAttribute(data: {
  name: string;
  code?: string;
  inputType: string;
  isVariantDefining: boolean;
  usesSwatches?: boolean;
  description?: string;
  isActive?: boolean;
}): Promise<{ ok: boolean; data?: any; error?: string; fieldErrors?: Record<string, string> }> {
  const user = await requireCatalogManager();

  // Validate with Zod
  const resolvedCode = (data.code && data.code.trim())
    ? data.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
    : data.name ? data.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") : "";

  const parsed = attributeInputSchema.safeParse({
    name: data.name,
    code: resolvedCode,
    inputType: data.inputType,
    isVariantDefining: Boolean(data.isVariantDefining),
    usesSwatches: Boolean(data.usesSwatches),
    description: data.description,
    isActive: data.isActive !== false,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Validation failed",
      fieldErrors: formatAttributeZodErrors(parsed.error),
    };
  }

  const validData = parsed.data;
  const nameTrimmed = validData.name;
  const baseSlug = validData.code;

  // Check unique name (case-insensitive) and code
  const existingName = await prisma.attribute.findFirst({
    where: {
      name: { equals: nameTrimmed },
      deletedAt: null,
    },
  });
  if (existingName) {
    return {
      ok: false,
      error: `An attribute named '${nameTrimmed}' already exists.`,
      fieldErrors: { name: `An attribute named '${nameTrimmed}' already exists.` },
    };
  }

  const existingCode = await prisma.attribute.findUnique({
    where: { code: baseSlug },
  });
  if (existingCode && !existingCode.deletedAt) {
    return {
      ok: false,
      error: `Code '${baseSlug}' is already taken. Please choose another.`,
      fieldErrors: { code: `Code '${baseSlug}' is already taken. Please choose another.` },
    };
  }

  // Only SINGLE_SELECT can be variant-defining (FR-03)
  const isVariant = data.inputType === "SINGLE_SELECT" ? Boolean(data.isVariantDefining) : false;

  // Auto-detect swatches if name matches colour/shade/finish
  const autoSwatches = data.usesSwatches ?? /colou?r|shade|finish/i.test(nameTrimmed);

  const attribute = await prisma.attribute.create({
    data: {
      name: nameTrimmed,
      code: baseSlug,
      inputType: data.inputType,
      isVariantDefining: isVariant,
      usesSwatches: autoSwatches,
      description: data.description?.trim() || null,
      isActive: data.isActive !== false,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: attribute.id,
      action: "CREATE_ATTRIBUTE",
      afterState: JSON.stringify({ id: attribute.id, name: attribute.name, code: attribute.code }),
    },
  });

  revalidatePath("/admin/attributes");
  revalidatePath("/admin/categories");
  return { ok: true, data: attribute };
}

export async function updateAttribute(
  id: string,
  data: {
    name?: string;
    description?: string;
    usesSwatches?: boolean;
    isActive?: boolean;
    isVariantDefining?: boolean;
  }
): Promise<{ ok: boolean; data?: any; error?: string; fieldErrors?: Record<string, string> }> {
  const user = await requireCatalogManager();

  const existing = await prisma.attribute.findUnique({
    where: { id },
    include: {
      _count: { select: { values: { where: { deletedAt: null } } } },
    },
  });

  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Attribute not found." };
  }

  const updatePayload: any = {};

  if (data.name !== undefined) {
    const nameTrimmed = data.name.trim();
    if (nameTrimmed.length < 2 || nameTrimmed.length > 50) {
      return {
        ok: false,
        error: "Attribute name must be between 2 and 50 characters.",
        fieldErrors: { name: "Attribute name must be between 2 and 50 characters." },
      };
    }

    const duplicate = await prisma.attribute.findFirst({
      where: {
        name: { equals: nameTrimmed },
        id: { not: id },
        deletedAt: null,
      },
    });
    if (duplicate) {
      return {
        ok: false,
        error: `An attribute named '${nameTrimmed}' already exists.`,
        fieldErrors: { name: `An attribute named '${nameTrimmed}' already exists.` },
      };
    }
    updatePayload.name = nameTrimmed;
  }

  if (data.description !== undefined) {
    updatePayload.description = data.description.trim() || null;
  }

  if (data.usesSwatches !== undefined) {
    updatePayload.usesSwatches = data.usesSwatches;
  }

  if (data.isActive !== undefined) {
    updatePayload.isActive = data.isActive;
  }

  if (data.isVariantDefining !== undefined && existing.inputType === "SINGLE_SELECT") {
    updatePayload.isVariantDefining = data.isVariantDefining;
  }

  const updated = await prisma.attribute.update({
    where: { id },
    data: updatePayload,
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: id,
      action: "UPDATE_ATTRIBUTE",
      afterState: JSON.stringify({ id, changes: updatePayload }),
    },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, data: updated };
}

export async function toggleAttributeStatus(id: string, isActive: boolean) {
  const user = await requireCatalogManager();

  const updated = await prisma.attribute.update({
    where: { id },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: id,
      action: isActive ? "ACTIVATE_ATTRIBUTE" : "DEACTIVATE_ATTRIBUTE",
      afterState: JSON.stringify({ id, name: updated.name, isActive }),
    },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, data: updated };
}

export async function deleteAttribute(id: string) {
  const user = await requireCatalogManager();

  const existing = await prisma.attribute.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          productValues: true,
          variantValues: true,
          categoryAttributes: true,
        },
      },
    },
  });

  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Attribute not found." };
  }

  const productUsage = Math.max(existing._count.productValues, existing._count.variantValues);

  // In-use guard (FR-09, ATTR-09)
  if (productUsage > 0) {
    return {
      ok: false,
      inUse: true,
      productCount: productUsage,
      error: `'${existing.name}' is used by ${productUsage} product${productUsage === 1 ? "" : "s"} and cannot be deleted. Deactivate it instead to hide it from new products.`,
    };
  }

  // Soft delete attribute
  await prisma.attribute.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: id,
      action: "DELETE_ATTRIBUTE",
      beforeState: JSON.stringify({ id, name: existing.name }),
    },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, message: `'${existing.name}' deleted successfully.` };
}

export async function bulkDeleteAttributes(ids: string[]) {
  const user = await requireCatalogManager();

  let deletedCount = 0;
  const skippedNames: string[] = [];

  for (const id of ids) {
    const attr = await prisma.attribute.findUnique({
      where: { id },
      include: {
        _count: { select: { productValues: true, variantValues: true } },
      },
    });
    if (!attr || attr.deletedAt) continue;

    const usage = Math.max(attr._count.productValues, attr._count.variantValues);
    if (usage > 0) {
      skippedNames.push(attr.name);
    } else {
      await prisma.attribute.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      deletedCount++;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: ids.join(","),
      action: "BULK_DELETE_ATTRIBUTES",
      afterState: JSON.stringify({ deletedCount, skipped: skippedNames }),
    },
  });

  revalidatePath("/admin/attributes");
  return {
    ok: true,
    deletedCount,
    skippedNames,
    message: `${deletedCount} attribute(s) deleted.${skippedNames.length > 0 ? ` ${skippedNames.length} in use were skipped (${skippedNames.join(", ")}).` : ""}`,
  };
}

export async function bulkToggleAttributes(ids: string[], isActive: boolean) {
  const user = await requireCatalogManager();

  await prisma.attribute.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "ATTRIBUTE",
      entityId: ids.join(","),
      action: isActive ? "BULK_ACTIVATE_ATTRIBUTES" : "BULK_DEACTIVATE_ATTRIBUTES",
      afterState: JSON.stringify({ ids, count: ids.length, isActive }),
    },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, message: `${ids.length} attribute(s) ${isActive ? "activated" : "deactivated"}.` };
}

// ─── ATTRIBUTE VALUES CRUD & REORDER ────────────────────────────────────────

export async function getAttributeValues(attributeId: string) {
  await requireCatalogManager();

  const values = await prisma.attributeValue.findMany({
    where: { attributeId, deletedAt: null },
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { variantAttributeValues: true } },
    },
  });

  return {
    ok: true,
    data: values.map((v) => ({
      id: v.id,
      attributeId: v.attributeId,
      label: v.label,
      code: v.code,
      swatchHex: v.swatchHex,
      swatchImageUrl: v.swatchImageUrl,
      displayOrder: v.displayOrder,
      isActive: v.isActive,
      variantCount: v._count.variantAttributeValues,
    })),
  };
}

export async function createAttributeValue(
  attributeId: string,
  data: {
    label: string;
    code?: string;
    swatchHex?: string;
    swatchImageUrl?: string;
  }
) {
  const user = await requireCatalogManager();

  const resolvedCode = (data.code && data.code.trim())
    ? data.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
    : data.label ? data.label.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") : "";

  const parsed = attributeValueInputSchema.safeParse({
    attributeId,
    label: data.label,
    code: resolvedCode,
    swatchHex: data.swatchHex,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Validation failed",
      fieldErrors: formatAttributeZodErrors(parsed.error),
    };
  }

  const labelTrimmed = parsed.data.label;
  const codeSlug = parsed.data.code;

  // Check duplicate code or label for this attribute
  const existing = await prisma.attributeValue.findFirst({
    where: {
      attributeId,
      deletedAt: null,
      OR: [
        { label: { equals: labelTrimmed } },
        { code: codeSlug },
      ],
    },
  });

  if (existing) {
    return { ok: false, error: `Value '${labelTrimmed}' already exists for this attribute.` };
  }

  // Compute next displayOrder
  const maxOrder = await prisma.attributeValue.aggregate({
    where: { attributeId, deletedAt: null },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

  const value = await prisma.attributeValue.create({
    data: {
      attributeId,
      label: labelTrimmed,
      code: codeSlug,
      swatchHex: data.swatchHex?.trim() || null,
      swatchImageUrl: data.swatchImageUrl?.trim() || null,
      displayOrder: nextOrder,
      isActive: true,
    },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, data: value };
}

export async function updateAttributeValue(
  id: string,
  data: {
    label?: string;
    swatchHex?: string | null;
    swatchImageUrl?: string | null;
    isActive?: boolean;
  }
) {
  await requireCatalogManager();

  const existing = await prisma.attributeValue.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Value not found." };
  }

  const updatePayload: any = {};

  if (data.label !== undefined) {
    const labelTrimmed = data.label.trim();
    if (!labelTrimmed) return { ok: false, error: "Label cannot be empty." };

    const duplicate = await prisma.attributeValue.findFirst({
      where: {
        attributeId: existing.attributeId,
        label: { equals: labelTrimmed },
        id: { not: id },
        deletedAt: null,
      },
    });
    if (duplicate) {
      return { ok: false, error: `Value '${labelTrimmed}' already exists for this attribute.` };
    }
    updatePayload.label = labelTrimmed;
  }

  if (data.swatchHex !== undefined) {
    updatePayload.swatchHex = data.swatchHex?.trim() || null;
  }

  if (data.swatchImageUrl !== undefined) {
    updatePayload.swatchImageUrl = data.swatchImageUrl?.trim() || null;
  }

  if (data.isActive !== undefined) {
    updatePayload.isActive = data.isActive;
  }

  const updated = await prisma.attributeValue.update({
    where: { id },
    data: updatePayload,
  });

  revalidatePath("/admin/attributes");
  return { ok: true, data: updated };
}

export async function deleteAttributeValue(id: string) {
  await requireCatalogManager();

  const existing = await prisma.attributeValue.findUnique({
    where: { id },
    include: {
      _count: { select: { variantAttributeValues: true } },
    },
  });

  if (!existing || existing.deletedAt) {
    return { ok: false, error: "Value not found." };
  }

  if (existing._count.variantAttributeValues > 0) {
    return {
      ok: false,
      inUse: true,
      error: `'${existing.label}' is used by ${existing._count.variantAttributeValues} variant(s) and cannot be deleted. Deactivate it instead.`,
    };
  }

  await prisma.attributeValue.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  revalidatePath("/admin/attributes");
  return { ok: true, message: `'${existing.label}' removed.` };
}

export async function reorderAttributeValues(attributeId: string, orderedIds: string[]) {
  await requireCatalogManager();

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.attributeValue.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );

  revalidatePath("/admin/attributes");
  return { ok: true, message: "Order updated successfully." };
}

export async function bulkCreateAttributeValues(attributeId: string, rawText: string) {
  await requireCatalogManager();

  const lines = rawText
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, error: "No valid values found to insert." };
  }

  // Get existing values
  const existingValues = await prisma.attributeValue.findMany({
    where: { attributeId, deletedAt: null },
    select: { label: true, code: true },
  });

  const existingLabels = new Set(existingValues.map((v) => v.label.toLowerCase()));
  const existingCodes = new Set(existingValues.map((v) => v.code.toLowerCase()));

  const maxOrder = await prisma.attributeValue.aggregate({
    where: { attributeId, deletedAt: null },
    _max: { displayOrder: true },
  });
  let currentOrder = (maxOrder._max.displayOrder || 0);

  const toCreate: Array<{ label: string; code: string; displayOrder: number }> = [];
  const skipped: string[] = [];

  for (const item of lines) {
    const codeSlug = item.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
    if (existingLabels.has(item.toLowerCase()) || existingCodes.has(codeSlug)) {
      skipped.push(item);
    } else {
      existingLabels.add(item.toLowerCase());
      existingCodes.add(codeSlug);
      currentOrder++;
      toCreate.push({
        label: item,
        code: codeSlug,
        displayOrder: currentOrder,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.attributeValue.createMany({
      data: toCreate.map((item) => ({
        attributeId,
        label: item.label,
        code: item.code,
        displayOrder: item.displayOrder,
        isActive: true,
      })),
    });
  }

  revalidatePath("/admin/attributes");
  return {
    ok: true,
    createdCount: toCreate.length,
    skippedCount: skipped.length,
    skipped,
    message: `Created ${toCreate.length} value(s).${skipped.length > 0 ? ` ${skipped.length} skipped as duplicates.` : ""}`,
  };
}
