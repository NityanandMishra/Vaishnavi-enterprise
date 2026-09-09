"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import {
  adjustStock,
  bulkAdjustStock,
  undoBulkAdjust,
  getOrCreateInventory,
  PreconditionRequiredError,
  ConflictError,
  InventoryError,
} from "@/lib/inventory/inventory-service";
import { ReasonCode } from "@/lib/inventory/types";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const role = (user as any)?.role;
  if (
    !session ||
    !user ||
    (role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      role !== "CATALOG_MANAGER" &&
      role !== "OPS_EXECUTIVE")
  ) {
    throw new Error("Unauthorized: Insufficient inventory permissions");
  }
  return user;
}

/**
 * INV-02: Adjust stock with mandatory reason and live balance outcome.
 */
export async function performStockAdjustment(data: {
  variantId: string;
  mode: "DELTA" | "ABSOLUTE";
  quantity: number;
  reasonCode: ReasonCode;
  note?: string;
  confirmLarge?: boolean;
}) {
  try {
    const user = await requireAdmin();

    const result = await adjustStock({
      variantId: data.variantId,
      mode: data.mode,
      quantity: data.quantity,
      reasonCode: data.reasonCode,
      note: data.note,
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      confirmLarge: data.confirmLarge,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/low-stock");
    revalidatePath("/admin/inventory/movements");

    return { ok: true, data: result };
  } catch (err: any) {
    if (err instanceof PreconditionRequiredError) {
      return {
        ok: false,
        status: 428,
        error: err.message,
        details: err.details,
      };
    }
    if (err instanceof ConflictError) {
      return {
        ok: false,
        status: 409,
        error: err.message,
      };
    }
    return {
      ok: false,
      status: err.statusCode || 400,
      error: err.message || "Failed to adjust stock",
    };
  }
}

/**
 * INV-09: Bulk stock adjustment with dryRun preview and commit.
 */
export async function performBulkAdjustment(data: {
  adjustments: Array<{ variantId: string; quantity: number }>;
  mode: "DELTA" | "ABSOLUTE";
  reasonCode: ReasonCode;
  note?: string;
  dryRun?: boolean;
}) {
  try {
    const user = await requireAdmin();

    const result = await bulkAdjustStock({
      adjustments: data.adjustments,
      mode: data.mode,
      reasonCode: data.reasonCode,
      note: data.note,
      actorId: (user as any).id || "admin",
      actorName: user.name || "Admin",
      dryRun: data.dryRun,
    });

    if (!data.dryRun) {
      revalidatePath("/admin/inventory");
      revalidatePath("/admin/inventory/low-stock");
      revalidatePath("/admin/inventory/movements");
    }

    return { ok: true, data: result };
  } catch (err: any) {
    return {
      ok: false,
      status: err.statusCode || 400,
      error: err.message || "Bulk adjustment failed",
    };
  }
}

/**
 * INV-09: 60-second Compensating Undo.
 */
export async function performUndoBulkAdjustment(batchId: string) {
  try {
    const user = await requireAdmin();

    const result = await undoBulkAdjust(
      batchId,
      (user as any).id || "admin",
      user.name || "Admin"
    );

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/low-stock");
    revalidatePath("/admin/inventory/movements");

    return { ok: true, data: result };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || "Failed to undo bulk adjustment",
    };
  }
}

/**
 * INV-07: Update low stock threshold or backorder setting inline.
 */
export async function updateVariantSettings(
  variantId: string,
  settings: { lowStockThreshold?: number; backorderEnabled?: boolean }
) {
  try {
    await requireAdmin();

    const inv = await getOrCreateInventory(variantId);

    const updated = await prisma.inventory.update({
      where: { id: inv.id },
      data: {
        lowStockThreshold:
          settings.lowStockThreshold !== undefined
            ? settings.lowStockThreshold
            : inv.lowStockThreshold,
        backorderEnabled:
          settings.backorderEnabled !== undefined
            ? settings.backorderEnabled
            : inv.backorderEnabled,
      },
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/low-stock");

    return { ok: true, data: updated };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || "Failed to update settings",
    };
  }
}

/**
 * INV-06: Fetch immutable movement ledger for a single variant.
 */
export async function fetchVariantMovements(variantId: string, page = 1, limit = 50) {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.inventoryMovement.count({
      where: { variantId },
    });

    return { ok: true, movements, total };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to fetch movements" };
  }
}
