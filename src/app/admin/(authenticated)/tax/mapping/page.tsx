import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import CategoryTaxMappingManager, {
  CategoryMappingNode,
  HsnOption,
} from "@/components/admin/tax/CategoryTaxMappingManager";

export const metadata: Metadata = {
  title: "Category Tax Mapping — Admin Portal",
  description: "Map categories to HSN codes and GST rates so products inherit correct tax treatment.",
};

export default async function CategoryTaxMappingPage() {
  const [categories, hsns] = await Promise.all([
    prisma.category.findMany({
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
    }),
    prisma.hsnCode.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ code: "asc" }],
      include: {
        rateVersions: {
          orderBy: [{ effectiveFrom: "desc" }],
          include: { slabs: true },
        },
      },
    }),
  ]);

  const now = new Date();

  function formatCategoryRow(c: any, isSubcategory = false): CategoryMappingNode {
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

  const topLevel = categories.filter((c) => !c.parentId);
  const formattedTree = topLevel.map((cat) => formatCategoryRow(cat, false));

  const allFormatted: CategoryMappingNode[] = [];
  function collect(node: CategoryMappingNode) {
    allFormatted.push(node);
    if (node.children) node.children.forEach(collect);
  }
  formattedTree.forEach(collect);

  const mappedCount = allFormatted.filter((r) => r.source !== "Missing").length;
  const unmappedCount = allFormatted.filter((r) => r.source === "Missing").length;

  const hsnOptions: HsnOption[] = hsns.map((h) => {
    const activeVersion =
      h.rateVersions.find(
        (v) => new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) >= now)
      ) || h.rateVersions[0];

    let rateDisplay = "";
    if (h.rateType === "SLAB") {
      const rates = (activeVersion?.slabs || []).map((s) => `${s.gstRate}%`);
      rateDisplay = Array.from(new Set(rates)).join(" / ") || "Slab";
    } else {
      rateDisplay = activeVersion?.gstRate !== null && activeVersion?.gstRate !== undefined ? `${activeVersion.gstRate}%` : "—";
    }

    return {
      id: h.id,
      code: h.code,
      description: h.description,
      rateDisplay,
    };
  });

  return (
    <CategoryTaxMappingManager
      tree={formattedTree}
      flat={allFormatted}
      hsns={hsnOptions}
      mappedCount={mappedCount}
      unmappedCount={unmappedCount}
    />
  );
}
