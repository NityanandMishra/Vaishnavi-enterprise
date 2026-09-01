"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";

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

export interface CategoryAttributeItem {
  id: string; // CategoryAttribute id or virtual id for inherited
  attributeId: string;
  name: string;
  code: string;
  inputType: string;
  isVariantDefining: boolean;
  isRequired: boolean;
  displayOrder: number;
  isInherited: boolean;
  inheritedFromName?: string;
  canRemove: boolean;
  canLoosenRequired: boolean;
  valuesCount: number;
  previewValues: Array<{ id: string; label: string; swatchHex: string | null }>;
}

export async function getCategoryAttributesWithInheritance(categoryId: string) {
  await requireCatalogManager();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      parent: {
        include: {
          parent: true, // handle up to 3 levels
        },
      },
      categoryAttributes: {
        include: {
          attribute: {
            include: {
              values: {
                where: { deletedAt: null },
                orderBy: { displayOrder: "asc" },
                take: 4,
              },
              _count: { select: { values: { where: { deletedAt: null } } } },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!category) {
    return { ok: false, error: "Category not found." };
  }

  // 1. Gather all ancestor IDs from root down to direct parent
  const ancestorHierarchy: Array<{ id: string; name: string }> = [];
  let currentParent = category.parent;
  while (currentParent) {
    ancestorHierarchy.unshift({ id: currentParent.id, name: currentParent.name });
    currentParent = currentParent.parent as any;
  }

  // 2. Fetch ancestor category attributes
  const ancestorCategoryAttributes = ancestorHierarchy.length > 0
    ? await prisma.categoryAttribute.findMany({
        where: { categoryId: { in: ancestorHierarchy.map((a) => a.id) } },
        include: {
          category: { select: { id: true, name: true } },
          attribute: {
            include: {
              values: {
                where: { deletedAt: null },
                orderBy: { displayOrder: "asc" },
                take: 4,
              },
              _count: { select: { values: { where: { deletedAt: null } } } },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      })
    : [];

  const attributeMap = new Map<string, CategoryAttributeItem>();

  // Add inherited first
  for (const ca of ancestorCategoryAttributes) {
    if (ca.attribute.deletedAt) continue;
    attributeMap.set(ca.attributeId, {
      id: `inherited_${ca.id}`,
      attributeId: ca.attributeId,
      name: ca.attribute.name,
      code: ca.attribute.code,
      inputType: ca.attribute.inputType,
      isVariantDefining: ca.attribute.isVariantDefining,
      isRequired: ca.isRequired,
      displayOrder: ca.displayOrder,
      isInherited: true,
      inheritedFromName: ca.category.name,
      canRemove: false,
      canLoosenRequired: !ca.isRequired, // If ancestor required it, child cannot loosen it
      valuesCount: ca.attribute._count.values,
      previewValues: ca.attribute.values.map((v) => ({
        id: v.id,
        label: v.label,
        swatchHex: v.swatchHex,
      })),
    });
  }

  // Merge own category attributes (can tighten required flag, or override order)
  for (const ca of category.categoryAttributes) {
    if (ca.attribute.deletedAt) continue;

    if (attributeMap.has(ca.attributeId)) {
      // Inherited attribute explicitly tightened at child level
      const existing = attributeMap.get(ca.attributeId)!;
      attributeMap.set(ca.attributeId, {
        ...existing,
        id: ca.id,
        isRequired: existing.isRequired || ca.isRequired,
        displayOrder: ca.displayOrder || existing.displayOrder,
      });
    } else {
      // Directly attached to this category
      attributeMap.set(ca.attributeId, {
        id: ca.id,
        attributeId: ca.attributeId,
        name: ca.attribute.name,
        code: ca.attribute.code,
        inputType: ca.attribute.inputType,
        isVariantDefining: ca.attribute.isVariantDefining,
        isRequired: ca.isRequired,
        displayOrder: ca.displayOrder,
        isInherited: false,
        canRemove: true,
        canLoosenRequired: true,
        valuesCount: ca.attribute._count.values,
        previewValues: ca.attribute.values.map((v) => ({
          id: v.id,
          label: v.label,
          swatchHex: v.swatchHex,
        })),
      });
    }
  }

  const resultList = Array.from(attributeMap.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return {
    ok: true,
    data: {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        parentName: category.parent?.name || null,
      },
      attributes: resultList,
      inheritedCount: resultList.filter((a) => a.isInherited).length,
    },
  };
}

export async function attachAttributesToCategory(categoryId: string, attributeIds: string[]) {
  const user = await requireCatalogManager();

  if (attributeIds.length === 0) {
    return { ok: false, error: "No attributes selected." };
  }

  // Validate attributes exist and SELECT types have >= 1 value (FR-06)
  const attributes = await prisma.attribute.findMany({
    where: { id: { in: attributeIds }, deletedAt: null },
    include: {
      _count: { select: { values: { where: { deletedAt: null } } } },
    },
  });

  for (const attr of attributes) {
    if (
      (attr.inputType === "SINGLE_SELECT" || attr.inputType === "MULTI_SELECT") &&
      attr._count.values === 0
    ) {
      return {
        ok: false,
        error: `Attribute '${attr.name}' has 0 values. Please add at least one value to '${attr.name}' before attaching it to a category.`,
      };
    }
  }

  // Get existing displayOrder max
  const maxOrder = await prisma.categoryAttribute.aggregate({
    where: { categoryId },
    _max: { displayOrder: true },
  });
  let currentOrder = maxOrder._max.displayOrder || 0;

  let attachedCount = 0;
  for (const attrId of attributeIds) {
    const existing = await prisma.categoryAttribute.findUnique({
      where: { categoryId_attributeId: { categoryId, attributeId: attrId } },
    });

    if (!existing) {
      currentOrder++;
      await prisma.categoryAttribute.create({
        data: {
          categoryId,
          attributeId: attrId,
          isRequired: false,
          displayOrder: currentOrder,
        },
      });
      attachedCount++;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "CATEGORY_ATTRIBUTES",
      entityId: categoryId,
      action: "CATEGORY_ATTRIBUTES_ATTACHED",
      afterState: JSON.stringify({ categoryId, attributeIds, count: attachedCount }),
    },
  });

  revalidatePath("/admin/categories");
  return { ok: true, message: `Attached ${attachedCount} attribute(s).` };
}

export async function updateCategoryAttribute(
  categoryId: string,
  attributeId: string,
  data: { isRequired?: boolean; displayOrder?: number }
) {
  await requireCatalogManager();

  // Check if inherited and parent requires it (FR-13)
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: true },
  });

  if (category?.parentId && data.isRequired === false) {
    const parentAttr = await prisma.categoryAttribute.findUnique({
      where: {
        categoryId_attributeId: {
          categoryId: category.parentId,
          attributeId,
        },
      },
    });

    if (parentAttr && parentAttr.isRequired) {
      return {
        ok: false,
        error: `'${category.parent?.name}' requires this attribute. Sub-categories cannot mark an inherited required attribute as optional.`,
      };
    }
  }

  const upserted = await prisma.categoryAttribute.upsert({
    where: { categoryId_attributeId: { categoryId, attributeId } },
    create: {
      categoryId,
      attributeId,
      isRequired: data.isRequired ?? false,
      displayOrder: data.displayOrder ?? 0,
    },
    update: {
      ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
    },
  });

  revalidatePath("/admin/categories");
  return { ok: true, data: upserted };
}

export async function reorderCategoryAttributes(categoryId: string, orderedAttributeIds: string[]) {
  await requireCatalogManager();

  await prisma.$transaction(
    orderedAttributeIds.map((attrId, index) =>
      prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId, attributeId: attrId } },
        create: {
          categoryId,
          attributeId: attrId,
          isRequired: false,
          displayOrder: index + 1,
        },
        update: {
          displayOrder: index + 1,
        },
      })
    )
  );

  revalidatePath("/admin/categories");
  return { ok: true, message: "Field display order updated." };
}

export async function detachCategoryAttribute(categoryId: string, attributeId: string) {
  const user = await requireCatalogManager();

  // Check product count in this category using this attribute (FR-14)
  const [productValuesCount, variantValuesCount] = await Promise.all([
    prisma.productAttributeValue.count({
      where: {
        attributeId,
        product: { categoryId, deletedAt: null },
      },
    }),
    prisma.variantAttributeValue.count({
      where: {
        attributeId,
        variant: { product: { categoryId, deletedAt: null } },
      },
    }),
  ]);

  const affectedCount = Math.max(productValuesCount, variantValuesCount);

  // Remove the category attribute link
  await prisma.categoryAttribute.deleteMany({
    where: { categoryId, attributeId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "CATEGORY_ATTRIBUTES",
      entityId: categoryId,
      action: "CATEGORY_ATTRIBUTE_DETACHED",
      afterState: JSON.stringify({ categoryId, attributeId, affectedProducts: affectedCount }),
    },
  });

  revalidatePath("/admin/categories");
  return {
    ok: true,
    affectedCount,
    message: affectedCount > 0
      ? `Detached attribute. Note: ${affectedCount} existing product(s) still hold historical values.`
      : "Attribute detached successfully.",
  };
}
