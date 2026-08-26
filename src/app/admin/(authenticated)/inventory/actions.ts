"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (!session || !user || (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CATALOG_MANAGER")) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function updateVariantStock(variantId: string, newStock: number) {
  const user = await requireAdmin();

  if (isNaN(newStock) || newStock < 0) {
    return { ok: false, error: "Stock must be a non-negative number." };
  }

  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });

  if (!existing) return { ok: false, error: "Variant not found." };

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: { stock: newStock, isAvailable: newStock > 0 },
  });

  // Log to Audit trail
  await prisma.auditLog.create({
    data: {
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      actorRole: (user as any).role || "ADMIN",
      entity: "VARIANT_STOCK",
      entityId: variantId,
      action: `Adjusted stock for ${existing.product.title} (${existing.title || "Standard"}): ${existing.stock} → ${newStock}`,
      beforeState: JSON.stringify({ stock: existing.stock, isAvailable: existing.isAvailable }),
      afterState: JSON.stringify({ stock: updated.stock, isAvailable: updated.isAvailable }),
    },
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/products/${existing.productId}`);
  return { ok: true, stock: updated.stock };
}

export async function bulkUpdateStock(variantIds: string[], stockAdjustment: number) {
  const user = await requireAdmin();

  if (isNaN(stockAdjustment) || stockAdjustment < 0) {
    return { ok: false, error: "Stock value must be a non-negative number." };
  }

  await prisma.productVariant.updateMany({
    where: { id: { in: variantIds } },
    data: { stock: stockAdjustment, isAvailable: stockAdjustment > 0 },
  });

  // Log to Audit trail
  await prisma.auditLog.create({
    data: {
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      actorRole: (user as any).role || "ADMIN",
      entity: "BULK_INVENTORY",
      entityId: variantIds.join(","),
      action: `Bulk updated ${variantIds.length} variants to ${stockAdjustment} units.`,
    },
  });

  revalidatePath("/admin/inventory");
  return { ok: true };
}
