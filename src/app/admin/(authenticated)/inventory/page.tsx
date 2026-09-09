import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getInventoryOverview } from "@/lib/inventory/inventory-service";
import StockOverview from "@/components/admin/inventory/StockOverview";

export const metadata: Metadata = {
  title: "Inventory Control & Ledger — Admin Portal",
};

export default async function AdminInventoryPage() {
  const [overview, categories, brands] = await Promise.all([
    getInventoryOverview({ limit: 500 }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <StockOverview
      initialData={{
        items: overview.items,
        stats: overview.stats,
        categories,
        brands,
        orderMap: overview.orderMap,
      }}
    />
  );
}
