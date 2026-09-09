import type { Metadata } from "next";
import { getInventoryOverview } from "@/lib/inventory/inventory-service";
import LowStockQueueClient from "./LowStockQueueClient";

export const metadata: Metadata = {
  title: "Low Stock & Restock Queue — Admin Portal",
};

export default async function LowStockQueuePage() {
  const overview = await getInventoryOverview({ limit: 1000 });

  // Filter to low stock or out of stock items
  const lowItems = overview.items.filter(
    (i) => i.stockStatus === "LOW_STOCK" || i.stockStatus === "OUT_OF_STOCK"
  );

  return (
    <LowStockQueueClient
      items={lowItems}
      stats={{
        lowStockCount: overview.stats.lowStockCount,
        outOfStockCount: overview.stats.outOfStockCount,
        totalNeedAction: lowItems.length,
      }}
      orderMap={overview.orderMap}
    />
  );
}
