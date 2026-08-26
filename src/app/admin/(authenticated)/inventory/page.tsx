import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import InventoryManager, { VariantInventoryItem } from "@/components/admin/InventoryManager";

export const metadata: Metadata = {
  title: "Admin — Stock & Inventory Control",
};

export default async function AdminInventoryPage() {
  const variants = await prisma.productVariant.findMany({
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: [{ stock: "asc" }],
  });

  const inventoryData: VariantInventoryItem[] = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    stock: v.stock,
    price: v.price,
    isAvailable: v.isAvailable,
    productId: v.productId,
    productTitle: v.product.title,
    productStockMode: v.product.stockMode,
    categoryName: v.product.category?.name || "General",
  }));

  return <InventoryManager inventory={inventoryData} />;
}
