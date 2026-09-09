import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import BulkUpdateClient from "./BulkUpdateClient";

export const metadata: Metadata = {
  title: "Bulk Stock Update & CSV Take — Admin Portal",
};

export default async function BulkStockPage() {
  const variants = await prisma.productVariant.findMany({
    where: { deletedAt: null, isActive: true },
    include: {
      product: true,
      inventories: { take: 1 },
    },
    orderBy: { sku: "asc" },
  });

  const availableVariants = variants.map((v) => ({
    id: v.id,
    sku: v.sku || "",
    productTitle: v.product.title,
    variantTitle: v.title,
    currentOnHand: v.inventories[0]?.onHand ?? 0,
    currentReserved: v.inventories[0]?.reserved ?? 0,
  }));

  return <BulkUpdateClient availableVariants={availableVariants} />;
}
