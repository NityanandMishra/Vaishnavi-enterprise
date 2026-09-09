import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import TaxPreviewCalculator, {
  HsnTaxData,
  CategoryTaxItem,
} from "@/components/admin/tax/TaxPreviewCalculator";

export const metadata: Metadata = {
  title: "Tax Calculation Preview — Admin Portal",
  description: "Live interactive calculator to preview GST splits, price slab evaluations, and invoice totals.",
};

export default async function TaxPreviewPage() {
  const [hsns, categories, settings] = await Promise.all([
    prisma.hsnCode.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ code: "asc" }],
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: {
            slabs: { orderBy: [{ minPrice: "asc" }] },
          },
        },
      },
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        hsnMapping: {
          include: { hsn: true },
        },
        parent: {
          include: {
            hsnMapping: {
              include: { hsn: true },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.taxSettings.findFirst(),
  ]);

  const formattedHsns: HsnTaxData[] = hsns.map((h) => ({
    id: h.id,
    code: h.code,
    description: h.description,
    rateType: h.rateType,
    cessRate: h.cessRate,
    rateVersions: h.rateVersions.map((v) => ({
      id: v.id,
      gstRate: v.gstRate,
      effectiveFrom: v.effectiveFrom.toISOString(),
      effectiveTo: v.effectiveTo ? v.effectiveTo.toISOString() : null,
      slabs: v.slabs.map((s) => ({
        id: s.id,
        minPrice: s.minPrice,
        maxPrice: s.maxPrice,
        gstRate: s.gstRate,
      })),
    })),
  }));

  const formattedCategories: CategoryTaxItem[] = categories.map((c) => {
    let hsnId: string | null = null;
    let hsnCode: string | null = null;
    let source = "Missing";

    if (c.hsnMapping?.hsn) {
      hsnId = c.hsnMapping.hsn.id;
      hsnCode = c.hsnMapping.hsn.code;
      source = c.parentId ? "Override" : "Direct";
    } else if (c.parent?.hsnMapping?.hsn) {
      hsnId = c.parent.hsnMapping.hsn.id;
      hsnCode = c.parent.hsnMapping.hsn.code;
      source = "Inherited";
    }

    return {
      id: c.id,
      name: c.name,
      hsnId,
      hsnCode,
      source,
    };
  });

  const sellerStateCode = settings?.sellerStateCode || "27";
  const pricingMode = settings?.pricingMode || "EXCLUSIVE";

  return (
    <TaxPreviewCalculator
      hsns={formattedHsns}
      categories={formattedCategories}
      sellerStateCode={sellerStateCode}
      pricingMode={pricingMode}
    />
  );
}
