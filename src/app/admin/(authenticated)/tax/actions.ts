"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  hsnInputSchema,
  HsnInput,
  rateVersionInputSchema,
  RateVersionInput,
  taxSettingsInputSchema,
  TaxSettingsInput,
  categoryHsnMappingSchema,
  bulkCategoryHsnSchema,
  taxPreviewInputSchema,
  TaxPreviewInput,
} from "@/lib/validations/tax";
import { calculateTax } from "@/lib/tax/tax-engine";
import {
  requireTaxRead,
  requireTaxWrite,
  requireTaxSettingsRead,
  requireTaxSettingsWrite,
} from "@/lib/tax/auth-helper";

export async function getHsnCodesAction() {
  await requireTaxRead();

  const hsnList = await prisma.hsnCode.findMany({
    where: { deletedAt: null },
    orderBy: [{ code: "asc" }],
    include: {
      rateVersions: {
        orderBy: [{ effectiveFrom: "desc" }],
        include: { slabs: { orderBy: [{ minPrice: "asc" }] } },
      },
      categoryMappings: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      _count: {
        select: { products: true, categoryMappings: true },
      },
    },
  });

  const now = new Date();

  return {
    ok: true,
    data: hsnList.map((hsn) => {
      const activeVersion =
        hsn.rateVersions.find(
          (v) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
        ) || hsn.rateVersions[0];

      const futureVersion = hsn.rateVersions.find((v) => new Date(v.effectiveFrom) > now);

      let rateDisplay = "";
      if (hsn.rateType === "SLAB") {
        const slabs = activeVersion?.slabs || [];
        const rates = slabs.map((s) => `${s.gstRate}%`);
        rateDisplay = Array.from(new Set(rates)).join(" / ") || "Slab";
      } else {
        rateDisplay = activeVersion ? `${activeVersion.gstRate}%` : "—";
      }

      let futureRateDisplay = null;
      if (futureVersion) {
        const fromStr = new Date(futureVersion.effectiveFrom).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        if (hsn.rateType === "SLAB") {
          const rates = (futureVersion.slabs || []).map((s) => `${s.gstRate}%`);
          futureRateDisplay = `${Array.from(new Set(rates)).join(" / ")} from ${fromStr}`;
        } else {
          futureRateDisplay = `${futureVersion.gstRate}% from ${fromStr}`;
        }
      }

      return {
        id: hsn.id,
        code: hsn.code,
        description: hsn.description,
        rateType: hsn.rateType,
        cessRate: hsn.cessRate,
        isActive: hsn.isActive,
        activeRateVersion: activeVersion,
        futureVersion: futureVersion || null,
        rateDisplay,
        futureRateDisplay,
        slabs: activeVersion?.slabs || [],
        categoriesCount: hsn._count.categoryMappings,
        productsCount: hsn._count.products,
        categories: hsn.categoryMappings.map((cm) => cm.category),
        rateVersionsCount: hsn.rateVersions.length,
        rateVersions: hsn.rateVersions,
        createdAt: hsn.createdAt,
        updatedAt: hsn.updatedAt,
      };
    }),
  };
}

export async function createHsnAction(raw: HsnInput) {
  const user = await requireTaxWrite();

  const parsed = hsnInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const data = parsed.data;

  const existing = await prisma.hsnCode.findFirst({
    where: { code: data.code, deletedAt: null },
  });

  if (existing) {
    return { ok: false, error: `HSN code ${data.code} already exists`, existingId: existing.id };
  }

  const effectiveFromDate = new Date(data.effectiveFrom);

  const hsn = await prisma.hsnCode.create({
    data: {
      code: data.code,
      description: data.description,
      rateType: data.rateType,
      cessRate: data.cessRate ?? 0,
      isActive: data.isActive,
      rateVersions: {
        create: {
          gstRate: data.rateType === "FLAT" ? data.gstRate : null,
          effectiveFrom: effectiveFromDate,
          createdBy: user.name,
          ...(data.rateType === "SLAB" &&
            data.slabs && {
              slabs: {
                create: data.slabs.map((s) => ({
                  minPrice: s.minPrice,
                  maxPrice: s.maxPrice ?? null,
                  gstRate: s.gstRate,
                })),
              },
            }),
        },
      },
    },
    include: {
      rateVersions: { include: { slabs: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "HSN",
      entityId: hsn.id,
      action: "HSN_CREATED",
      afterState: JSON.stringify(hsn),
    },
  });

  revalidatePath("/admin/tax/hsn");
  revalidatePath("/config/tax/hsn");
  return { ok: true, data: hsn };
}

export async function updateHsnMetadataAction(
  id: string,
  raw: { description?: string; cessRate?: number; isActive?: boolean }
) {
  const user = await requireTaxWrite();

  const hsn = await prisma.hsnCode.findUnique({ where: { id } });
  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  const updated = await prisma.hsnCode.update({
    where: { id },
    data: {
      ...(raw.description !== undefined && { description: raw.description.trim() }),
      ...(raw.cessRate !== undefined && { cessRate: Number(raw.cessRate) }),
      ...(raw.isActive !== undefined && { isActive: Boolean(raw.isActive) }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "HSN",
      entityId: hsn.id,
      action: "HSN_UPDATED",
      beforeState: JSON.stringify(hsn),
      afterState: JSON.stringify(updated),
    },
  });

  revalidatePath("/admin/tax/hsn");
  revalidatePath("/config/tax/hsn");
  return { ok: true, data: updated };
}

export async function createRateVersionAction(hsnId: string, raw: RateVersionInput) {
  const user = await requireTaxWrite();

  const hsn = await prisma.hsnCode.findUnique({
    where: { id: hsnId },
    include: { rateVersions: { orderBy: [{ effectiveFrom: "desc" }] } },
  });

  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  const parsed = rateVersionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const data = parsed.data;
  const newEffectiveFrom = new Date(data.effectiveFrom);

  const prevEffectiveTo = new Date(newEffectiveFrom);
  prevEffectiveTo.setDate(prevEffectiveTo.getDate() - 1);
  prevEffectiveTo.setHours(23, 59, 59, 999);

  const priorVersion =
    hsn.rateVersions.find(
      (v) => new Date(v.effectiveFrom) < newEffectiveFrom && (!v.effectiveTo || new Date(v.effectiveTo) >= newEffectiveFrom)
    ) || hsn.rateVersions[0];

  const result = await prisma.$transaction(async (tx) => {
    if (priorVersion) {
      await tx.hsnRateVersion.update({
        where: { id: priorVersion.id },
        data: { effectiveTo: prevEffectiveTo },
      });
    }

    return await tx.hsnRateVersion.create({
      data: {
        hsnId,
        gstRate: hsn.rateType === "FLAT" ? data.gstRate : null,
        effectiveFrom: newEffectiveFrom,
        createdBy: user.name,
        ...(hsn.rateType === "SLAB" &&
          data.slabs && {
            slabs: {
              create: data.slabs.map((s) => ({
                minPrice: s.minPrice,
                maxPrice: s.maxPrice ?? null,
                gstRate: s.gstRate,
              })),
            },
          }),
      },
      include: { slabs: true },
    });
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "HSN",
      entityId: hsn.id,
      action: "HSN_RATE_VERSION_CREATED",
      afterState: JSON.stringify(result),
    },
  });

  revalidatePath("/admin/tax/hsn");
  revalidatePath("/config/tax/hsn");
  return { ok: true, data: result };
}

export async function deleteHsnAction(id: string) {
  const user = await requireTaxWrite();

  const hsn = await prisma.hsnCode.findUnique({
    where: { id },
    include: {
      _count: { select: { categoryMappings: true, products: true } },
    },
  });

  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  const mappedCategories = hsn._count.categoryMappings;
  const usedProducts = hsn._count.products;

  if (mappedCategories > 0 || usedProducts > 0) {
    let reason = `HSN ${hsn.code} is`;
    if (mappedCategories > 0 && usedProducts > 0) {
      reason += ` mapped to ${mappedCategories} ${mappedCategories === 1 ? "category" : "categories"} and used by ${usedProducts} ${usedProducts === 1 ? "product" : "products"}.`;
    } else if (mappedCategories > 0) {
      reason += ` mapped to ${mappedCategories} ${mappedCategories === 1 ? "category" : "categories"}.`;
    } else {
      reason += ` used by ${usedProducts} ${usedProducts === 1 ? "product" : "products"}.`;
    }
    reason += " Remove the mappings first, or deactivate this code.";

    return { ok: false, error: reason };
  }

  const deleted = await prisma.hsnCode.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "HSN",
      entityId: hsn.id,
      action: "HSN_DELETED",
      beforeState: JSON.stringify(hsn),
    },
  });

  revalidatePath("/admin/tax/hsn");
  revalidatePath("/config/tax/hsn");
  return { ok: true, message: `HSN ${hsn.code} deleted.` };
}

export async function getCategoryMappingsAction() {
  await requireTaxRead();

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      hsnMapping: {
        include: {
          hsn: {
            include: {
              rateVersions: {
                orderBy: [{ effectiveFrom: "desc" }],
                include: { slabs: true },
              },
            },
          },
        },
      },
      parent: {
        include: {
          hsnMapping: {
            include: {
              hsn: {
                include: {
                  rateVersions: {
                    orderBy: [{ effectiveFrom: "desc" }],
                    include: { slabs: true },
                  },
                },
              },
            },
          },
        },
      },
      children: {
        where: { deletedAt: null },
        include: {
          hsnMapping: {
            include: {
              hsn: {
                include: {
                  rateVersions: {
                    orderBy: [{ effectiveFrom: "desc" }],
                    include: { slabs: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const now = new Date();

  function formatCategoryRow(c: any, isSubcategory = false) {
    let hsn: any = null;
    let source: "Direct" | "Inherited" | "Override" | "Missing" = "Missing";

    if (c.hsnMapping?.hsn) {
      hsn = c.hsnMapping.hsn;
      source = isSubcategory ? "Override" : "Direct";
    } else if (c.parent?.hsnMapping?.hsn) {
      hsn = c.parent.hsnMapping.hsn;
      source = "Inherited";
    }

    let rateDisplay = "—";
    if (hsn) {
      const activeVersion =
        hsn.rateVersions?.find(
          (v: any) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
        ) || hsn.rateVersions?.[0];

      if (hsn.rateType === "SLAB") {
        const rates = (activeVersion?.slabs || []).map((s: any) => `${s.gstRate}%`);
        rateDisplay = Array.from(new Set(rates)).join(" / ") || "Slab";
      } else {
        rateDisplay = activeVersion?.gstRate !== null && activeVersion?.gstRate !== undefined ? `${activeVersion.gstRate}%` : "—";
      }
    }

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      parentName: c.parent?.name || null,
      isSubcategory,
      hsnId: hsn?.id || null,
      hsnCode: hsn?.code || null,
      hsnDescription: hsn?.description || null,
      rateDisplay,
      source,
      hasDirectMapping: Boolean(c.hsnMapping),
      children: (c.children || []).map((child: any) => formatCategoryRow(child, true)),
    };
  }

  // Filter top-level
  const topLevel = categories.filter((c) => !c.parentId);
  const formattedTree = topLevel.map((cat) => formatCategoryRow(cat, false));

  // Flattened list for summary counts
  const allFormatted: any[] = [];
  function collect(node: any) {
    allFormatted.push(node);
    if (node.children) node.children.forEach(collect);
  }
  formattedTree.forEach(collect);

  const mappedCount = allFormatted.filter((r) => r.source !== "Missing").length;
  const unmappedCount = allFormatted.filter((r) => r.source === "Missing").length;

  return {
    ok: true,
    data: {
      tree: formattedTree,
      flat: allFormatted,
      mappedCount,
      unmappedCount,
      totalCount: allFormatted.length,
    },
  };
}

export async function mapCategoryHsnAction(categoryId: string, hsnId: string) {
  const user = await requireTaxWrite();

  const hsn = await prisma.hsnCode.findUnique({ where: { id: hsnId } });
  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  const mapping = await prisma.categoryHsnMapping.upsert({
    where: { categoryId },
    create: { categoryId, hsnId },
    update: { hsnId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "CATEGORY_HSN_MAPPING",
      entityId: categoryId,
      action: "MAP_CATEGORY_HSN",
      afterState: JSON.stringify({ categoryId, hsnCode: hsn.code }),
    },
  });

  revalidatePath("/admin/tax/mapping");
  revalidatePath("/config/tax/mapping");
  return { ok: true, data: mapping };
}

export async function bulkMapCategoryHsnAction(categoryIds: string[], hsnId: string) {
  const user = await requireTaxWrite();

  const hsn = await prisma.hsnCode.findUnique({ where: { id: hsnId } });
  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  await prisma.$transaction(
    categoryIds.map((catId) =>
      prisma.categoryHsnMapping.upsert({
        where: { categoryId: catId },
        create: { categoryId: catId, hsnId },
        update: { hsnId },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "CATEGORY_HSN_MAPPING",
      entityId: "BULK",
      action: "BULK_MAP_CATEGORY_HSN",
      afterState: JSON.stringify({ categoryIds, hsnCode: hsn.code }),
    },
  });

  revalidatePath("/admin/tax/mapping");
  revalidatePath("/config/tax/mapping");
  return { ok: true, count: categoryIds.length, hsnCode: hsn.code };
}

export async function removeCategoryHsnMappingAction(categoryId: string) {
  const user = await requireTaxWrite();

  const existing = await prisma.categoryHsnMapping.findUnique({
    where: { categoryId },
  });

  if (!existing) {
    return { ok: false, error: "Mapping not found" };
  }

  await prisma.categoryHsnMapping.delete({
    where: { categoryId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "CATEGORY_HSN_MAPPING",
      entityId: categoryId,
      action: "REMOVE_CATEGORY_HSN_OVERRIDE",
      beforeState: JSON.stringify(existing),
    },
  });

  revalidatePath("/admin/tax/mapping");
  revalidatePath("/config/tax/mapping");
  return { ok: true };
}

export async function getTaxSettingsAction() {
  const user = await requireTaxSettingsRead();

  let settings = await prisma.taxSettings.findFirst({
    include: {
      defaultHsn: {
        select: { id: true, code: true, description: true, rateType: true },
      },
    },
  });

  if (!settings) {
    settings = await prisma.taxSettings.create({
      data: {
        sellerStateCode: "27",
        sellerGstin: "27AABCV1234K1Z5",
        pricingMode: "EXCLUSIVE",
      },
      include: {
        defaultHsn: {
          select: { id: true, code: true, description: true, rateType: true },
        },
      },
    });
  }

  const productCount = await prisma.product.count({ where: { deletedAt: null } });

  return {
    ok: true,
    data: {
      ...settings,
      productCount,
      isSuperAdmin: user.role === "SUPER_ADMIN" || user.role === "ADMIN",
    },
  };
}

export async function updateTaxSettingsAction(raw: TaxSettingsInput) {
  const user = await requireTaxSettingsWrite();

  const parsed = taxSettingsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const data = parsed.data;

  let settings = await prisma.taxSettings.findFirst();
  if (!settings) {
    settings = await prisma.taxSettings.create({
      data: {
        sellerStateCode: "27",
        sellerGstin: "27AABCV1234K1Z5",
        pricingMode: "EXCLUSIVE",
      },
    });
  }

  // Heavy gate confirmation if changing pricing mode with existing products (TAX-05)
  if (data.pricingMode !== settings.pricingMode) {
    const productCount = await prisma.product.count({ where: { deletedAt: null } });
    if (productCount > 0 && data.confirmationToken !== "SWITCH") {
      return {
        ok: false,
        needsSwitchConfirmation: true,
        productCount,
        error: `Switching to ${
          data.pricingMode === "INCLUSIVE" ? "tax-inclusive" : "tax-exclusive"
        } changes what every one of your ${productCount} products charges the customer. Existing orders are unaffected. Type SWITCH to confirm.`,
      };
    }
  }

  const updated = await prisma.taxSettings.update({
    where: { id: settings.id },
    data: {
      sellerStateCode: data.sellerStateCode,
      sellerGstin: data.sellerGstin,
      pricingMode: data.pricingMode,
      defaultHsnId: data.defaultHsnId || null,
    },
    include: {
      defaultHsn: {
        select: { id: true, code: true, description: true, rateType: true },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      entity: "TAX_SETTINGS",
      entityId: updated.id,
      action: "UPDATE_TAX_SETTINGS",
      beforeState: JSON.stringify(settings),
      afterState: JSON.stringify(updated),
    },
  });

  revalidatePath("/admin/tax/settings");
  revalidatePath("/config/tax/settings");
  return { ok: true, data: updated };
}

export async function previewTaxAction(raw: TaxPreviewInput) {
  await requireTaxRead();

  const parsed = taxPreviewInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", issues: parsed.error.format() };
  }

  const { price, quantity, discount, hsnId, deliveryStateCode } = parsed.data;

  const [hsn, settings] = await Promise.all([
    prisma.hsnCode.findUnique({
      where: { id: hsnId },
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: { slabs: true },
        },
      },
    }),
    prisma.taxSettings.findFirst(),
  ]);

  if (!hsn || hsn.deletedAt) {
    return { ok: false, error: "HSN code not found" };
  }

  const sellerStateCode = settings?.sellerStateCode || "27";
  const pricingMode = settings?.pricingMode || "EXCLUSIVE";

  const result = calculateTax({
    unitPrice: price,
    quantity,
    discountPerUnit: discount,
    hsn,
    sellerStateCode,
    deliveryStateCode,
    pricingMode,
  });

  return {
    ok: true,
    data: {
      perUnitAfterDiscount: result.perUnitAfterDiscount,
      taxableValue: result.taxableValue,
      gstRate: result.gstRate,
      cessRate: result.cessRate,
      cgst: result.cgstAmount,
      sgst: result.sgstAmount,
      igst: result.igstAmount,
      cess: result.cessAmount,
      totalTax: result.totalTax,
      total: result.lineTotal,
      slabApplied: result.slabApplied,
      breakdownNote: result.breakdownNote,
      pricingMode,
      sellerStateCode,
      deliveryStateCode,
    },
  };
}
