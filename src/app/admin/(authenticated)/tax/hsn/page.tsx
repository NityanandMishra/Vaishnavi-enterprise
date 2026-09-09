import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import HsnManager, { HsnItem } from "@/components/admin/tax/HsnManager";
import { getStateNameByCode } from "@/lib/tax/indian-states";

export const metadata: Metadata = {
  title: "HSN Codes & GST Rates — Admin Portal",
  description: "Maintain official CBIC HSN codes, flat and price-slab GST rates, and rate history.",
};

export default async function HsnListPage() {
  const [hsnList, categories, settings] = await Promise.all([
    prisma.hsnCode.findMany({
      where: { deletedAt: null },
      orderBy: [{ code: "asc" }],
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: {
            slabs: { orderBy: [{ minPrice: "asc" }] },
          },
        },
        _count: {
          select: { categoryMappings: true, products: true },
        },
      },
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        hsnMapping: true,
        parent: { include: { hsnMapping: true } },
      },
    }),
    prisma.taxSettings.findFirst(),
  ]);

  const unmappedCount = categories.filter(
    (c) => !c.hsnMapping && !c.parent?.hsnMapping
  ).length;

  const now = new Date();
  const sellerStateName = getStateNameByCode(settings?.sellerStateCode || "27");

  const formatted: HsnItem[] = hsnList.map((hsn) => {
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
      rateDisplay = activeVersion?.gstRate !== null && activeVersion?.gstRate !== undefined ? `${activeVersion.gstRate}%` : "—";
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
      rateVersions: hsn.rateVersions,
      createdAt: hsn.createdAt.toISOString(),
      updatedAt: hsn.updatedAt.toISOString(),
    };
  });

  return (
    <HsnManager
      initialHsns={formatted}
      unmappedCount={unmappedCount}
      sellerStateName={sellerStateName}
    />
  );
}
