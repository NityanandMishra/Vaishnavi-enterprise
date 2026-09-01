"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";

async function requireCatalogManager() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (!session || !user || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    throw new Error("Unauthorized");
  }
}

export interface SelectedAttributePayload {
  attributeId: string;
  attributeName: string;
  attributeCode: string;
  values: Array<{
    id: string;
    label: string;
    code: string;
    swatchHex?: string | null;
  }>;
}

export interface GeneratedVariantPreview {
  tempId: string;
  existingId?: string;
  title: string;
  sku: string;
  price: number;
  mrp?: number | null;
  stock: number;
  isActive: boolean;
  isExisting: boolean;
  combination: Array<{
    attributeId: string;
    attributeName: string;
    attributeValueId: string;
    label: string;
    code: string;
    swatchHex?: string | null;
  }>;
}

function cleanSlug(str: string, maxLength = 8): string {
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, maxLength);
}

export async function generateVariantCombinations(params: {
  brandSlug?: string;
  categorySlug?: string;
  productTitle: string;
  attributes: SelectedAttributePayload[];
  basePrice?: number;
  baseMrp?: number;
  existingVariants?: Array<{
    id: string;
    sku: string;
    price: number | null;
    mrp: number | null;
    stock: number;
    isActive: boolean;
    attributeValueIds: string[];
  }>;
}) {
  await requireCatalogManager();

  const {
    brandSlug = "VE",
    categorySlug = "CAT",
    productTitle,
    attributes,
    basePrice = 0,
    baseMrp = null,
    existingVariants = [],
  } = params;

  // Filter only attributes with at least 1 selected value
  const activeAttributes = attributes.filter((a) => a.values.length > 0);

  if (activeAttributes.length === 0) {
    return { ok: false, error: "Please select at least one value for each defining attribute." };
  }

  // Calculate total combinations
  const totalCombinations = activeAttributes.reduce((acc, curr) => acc * curr.values.length, 1);

  if (totalCombinations > 200) {
    return {
      ok: false,
      error: `${totalCombinations} combinations exceeds the 200-variant limit. Reduce the selected values, or split this into separate products.`,
    };
  }

  // Helper cartesian product generator
  function cartesian(
    arrays: Array<Array<{ attributeId: string; attributeName: string; value: SelectedAttributePayload["values"][0] }>>
  ) {
    return arrays.reduce(
      (acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])),
      [[]] as Array<Array<{ attributeId: string; attributeName: string; value: SelectedAttributePayload["values"][0] }>>
    );
  }

  const attributeValueSets = activeAttributes.map((attr) =>
    attr.values.map((v) => ({
      attributeId: attr.attributeId,
      attributeName: attr.attributeName,
      value: v,
    }))
  );

  const rawCombos = cartesian(attributeValueSets);

  // Map existing variants by sorted attributeValueIds string for non-destructive extension (FR-21)
  const existingMap = new Map<string, (typeof existingVariants)[0]>();
  for (const ev of existingVariants) {
    const key = [...ev.attributeValueIds].sort().join(":");
    existingMap.set(key, ev);
  }

  const brandPart = cleanSlug(brandSlug || "VE", 6);
  const catPart = cleanSlug(categorySlug || "CAT", 6);
  const prodPart = cleanSlug(productTitle || "PROD", 8);

  const generatedList: GeneratedVariantPreview[] = [];

  for (let i = 0; i < rawCombos.length; i++) {
    const combo = rawCombos[i];
    const comboValueIds = combo.map((c) => c.value.id).sort();
    const comboKey = comboValueIds.join(":");

    const title = combo.map((c) => c.value.label).join(" / ");
    const valCodes = combo.map((c) => cleanSlug(c.value.code, 6)).join("-");

    const existingMatch = existingMap.get(comboKey);

    if (existingMatch) {
      // Retain existing SKU, price, stock, isActive
      generatedList.push({
        tempId: existingMatch.id,
        existingId: existingMatch.id,
        title,
        sku: existingMatch.sku,
        price: existingMatch.price ?? basePrice,
        mrp: existingMatch.mrp ?? baseMrp,
        stock: existingMatch.stock,
        isActive: existingMatch.isActive,
        isExisting: true,
        combination: combo.map((c) => ({
          attributeId: c.attributeId,
          attributeName: c.attributeName,
          attributeValueId: c.value.id,
          label: c.value.label,
          code: c.value.code,
          swatchHex: c.value.swatchHex,
        })),
      });
    } else {
      // Auto-generate fresh SKU: {BRAND}-{CATEGORY}-{PRODUCT}-{VAL1}-{VAL2} (FR-19)
      const generatedSku = `${brandPart}-${catPart}-${prodPart}-${valCodes}`.replace(/-+/g, "-");

      generatedList.push({
        tempId: `gen_${i}_${Date.now()}`,
        title,
        sku: generatedSku,
        price: basePrice,
        mrp: baseMrp,
        stock: 0,
        isActive: true,
        isExisting: false,
        combination: combo.map((c) => ({
          attributeId: c.attributeId,
          attributeName: c.attributeName,
          attributeValueId: c.value.id,
          label: c.value.label,
          code: c.value.code,
          swatchHex: c.value.swatchHex,
        })),
      });
    }
  }

  return {
    ok: true,
    variants: generatedList,
    totalCount: generatedList.length,
    newCount: generatedList.filter((v) => !v.isExisting).length,
  };
}

export async function checkSkuAvailability(sku: string, excludeVariantId?: string) {
  await requireCatalogManager();

  const trimmed = sku.trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, error: "SKU cannot be empty." };
  }

  const existing = await prisma.productVariant.findFirst({
    where: {
      sku: trimmed,
      ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      deletedAt: null,
    },
    select: { id: true, title: true, product: { select: { title: true } } },
  });

  if (existing) {
    return {
      ok: false,
      available: false,
      error: `SKU '${trimmed}' is already in use by '${existing.product.title} (${existing.title})'.`,
    };
  }

  return { ok: true, available: true };
}
