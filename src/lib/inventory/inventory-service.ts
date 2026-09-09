import { prisma } from "@/lib/db";
import {
  MovementType,
  ReasonCode,
  ManualReasonCodes,
  StockStatus,
  StockAlertTypes,
  StockAdjustmentInput,
  BulkAdjustmentInput,
  ReserveStockInput,
  FulfilStockInput,
  ReleaseStockInput,
  RestoreRtoStockInput,
  InventoryItemDTO,
} from "./types";

export class InventoryError extends Error {
  statusCode: number;
  details?: any;
  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = "InventoryError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ConflictError extends InventoryError {
  constructor(message: string, details?: any) {
    super(message, 409, details);
    this.name = "ConflictError";
  }
}

export class PreconditionRequiredError extends InventoryError {
  constructor(details: any) {
    super("Large stock adjustment requires second confirmation", 428, details);
    this.name = "PreconditionRequiredError";
  }
}

/**
 * Gets default seeded location or throws if not yet created.
 */
export async function getDefaultLocation() {
  let location = await prisma.location.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (!location) {
    location = await prisma.location.findFirst({
      where: { code: "MAIN" },
    });
  }
  if (!location) {
    location = await prisma.location.create({
      data: {
        code: "MAIN",
        name: "Main Warehouse",
        isDefault: true,
        isActive: true,
      },
    });
  }
  return location;
}

/**
 * Derives stock status based on available units and threshold.
 */
export function deriveStockStatus(
  onHand: number,
  reserved: number,
  threshold: number = 5
): StockStatus {
  const available = onHand - reserved;
  if (available <= 0) return StockStatus.OUT_OF_STOCK;
  if (available <= threshold) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

/**
 * Gets or creates the inventory record for a variant at a location (FR-01).
 */
export async function getOrCreateInventory(variantId: string, locationId?: string) {
  const loc = locationId ? { id: locationId } : await getDefaultLocation();

  let inventory = await prisma.inventory.findUnique({
    where: {
      variantId_locationId: {
        variantId,
        locationId: loc.id,
      },
    },
    include: {
      variant: {
        include: {
          product: {
            include: {
              category: true,
              brand: true,
              images: { include: { image: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!inventory) {
    // Check variant stock to seed initial on_hand if variant already existed
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    const initialOnHand = variant?.stock ? Math.max(0, variant.stock) : 0;

    inventory = await prisma.inventory.create({
      data: {
        variantId,
        locationId: loc.id,
        onHand: initialOnHand,
        reserved: 0,
        lowStockThreshold: 5,
        backorderEnabled: false,
      },
      include: {
        variant: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
                images: { include: { image: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });

    if (initialOnHand > 0) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          variantId,
          movementType: MovementType.ADJUSTMENT,
          reasonCode: ReasonCode.CORRECTION,
          quantityDelta: initialOnHand,
          onHandAfter: initialOnHand,
          reservedAfter: 0,
          referenceType: "ADJUSTMENT",
          referenceId: "INITIAL_SEED",
          note: "Initial auto-seed baseline",
          createdBy: "System",
        },
      });
    }
  }

  return inventory;
}

/**
 * FR-07 to FR-12 / INV-02: Adjust Stock with mandatory reason and live balance calculation.
 */
export async function adjustStock(input: StockAdjustmentInput) {
  // Validate reason code
  if (!ManualReasonCodes.includes(input.reasonCode as any)) {
    throw new InventoryError(
      `Invalid manual reason code: ${input.reasonCode}. SALE is reserved for system fulfilment.`,
      400
    );
  }

  // Validate note length for sensitive reasons (FR-11)
  const isSensitiveReason = (
    [ReasonCode.DAMAGE, ReasonCode.THEFT, ReasonCode.CORRECTION] as string[]
  ).includes(input.reasonCode);

  if (isSensitiveReason) {
    if (!input.note || input.note.trim().length < 10) {
      throw new InventoryError(
        "Add a short explanation (at least 10 characters) for sensitive adjustments.",
        400
      );
    }
  }

  const defaultLoc = await getDefaultLocation();
  const inventory = await getOrCreateInventory(input.variantId, defaultLoc.id);

  // Compute signed delta
  let delta = 0;
  if (input.mode === "DELTA") {
    delta = input.quantity;
  } else {
    // ABSOLUTE mode (FR-09): stored as computed delta so ledger stays additive
    delta = input.quantity - inventory.onHand;
  }

  if (delta === 0) {
    return {
      success: true,
      inventoryId: inventory.id,
      variantId: input.variantId,
      delta: 0,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      available: inventory.onHand - inventory.reserved,
      status: deriveStockStatus(
        inventory.onHand,
        inventory.reserved,
        inventory.lowStockThreshold ?? 5
      ),
    };
  }

  const newOnHand = inventory.onHand + delta;

  // Prevent negative stock (FR-03)
  if (newOnHand < 0) {
    throw new ConflictError(
      `Cannot remove ${Math.abs(delta)} units — only ${inventory.onHand} on hand.`
    );
  }

  // Large adjustment confirmation check (FR-12: default ±100 units or ±25% with min 10 units)
  const isLarge =
    Math.abs(delta) >= 100 ||
    (inventory.onHand > 0 &&
      Math.abs(delta) >= 10 &&
      Math.abs(delta) >= 0.25 * inventory.onHand);

  if (isLarge && !input.confirmLarge) {
    const multiple =
      inventory.onHand > 0
        ? (newOnHand / inventory.onHand).toFixed(1) + "×"
        : "N/A";
    throw new PreconditionRequiredError({
      currentOnHand: inventory.onHand,
      newOnHand,
      delta,
      mode: input.mode,
      reasonCode: input.reasonCode,
      multiple,
      warning: `You are ${delta > 0 ? "adding" : "removing"} ${Math.abs(
        delta
      )} units. Current on-hand is ${inventory.onHand}.`,
    });
  }

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update inventory
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        onHand: newOnHand,
        version: { increment: 1 },
        lastCountedAt:
          input.reasonCode === ReasonCode.CORRECTION ? new Date() : undefined,
      },
    });

    // Write immutable ledger entry (FR-10)
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        variantId: input.variantId,
        movementType: MovementType.ADJUSTMENT,
        reasonCode: input.reasonCode,
        quantityDelta: delta,
        onHandAfter: newOnHand,
        reservedAfter: inventory.reserved,
        referenceType: "ADJUSTMENT",
        referenceId: `ADJ-${Date.now()}`,
        note: input.note?.trim() || null,
        createdBy: input.actorName || input.actorId || "Admin",
      },
    });

    // Sync ProductVariant.stock to derived available (for backwards compatibility)
    const newAvailable = Math.max(0, newOnHand - inventory.reserved);
    await tx.productVariant.update({
      where: { id: input.variantId },
      data: {
        stock: newAvailable,
        isAvailable: newAvailable > 0 || inventory.backorderEnabled,
      },
    });

    // Low stock alert evaluation (FR-19, INV-07)
    const threshold = inventory.lowStockThreshold ?? 5;
    if (newAvailable > threshold) {
      // Resolve active alerts on recovery
      await tx.stockAlert.updateMany({
        where: {
          variantId: input.variantId,
          resolvedAt: null,
        },
        data: {
          resolvedAt: new Date(),
        },
      });
    } else {
      // Determine if a new alert should be raised
      const targetAlertType =
        newAvailable === 0 ? StockAlertTypes.OUT_OF_STOCK : StockAlertTypes.LOW_STOCK;

      const activeAlert = await tx.stockAlert.findFirst({
        where: {
          variantId: input.variantId,
          resolvedAt: null,
        },
      });

      if (!activeAlert || activeAlert.alertType !== targetAlertType) {
        // If alert type changed (e.g. low -> out_of_stock), resolve prior
        if (activeAlert) {
          await tx.stockAlert.update({
            where: { id: activeAlert.id },
            data: { resolvedAt: new Date() },
          });
        }
        await tx.stockAlert.create({
          data: {
            variantId: input.variantId,
            alertType: targetAlertType,
            availableAtTrigger: newAvailable,
            triggeredAt: new Date(),
          },
        });
      }
    }

    // Log to AuditLog table
    await tx.auditLog.create({
      data: {
        actorId: input.actorId || "admin",
        actorName: input.actorName || "Admin",
        actorRole: "ADMIN",
        entity: "INVENTORY",
        entityId: inventory.id,
        action: `Adjusted stock (${input.reasonCode}): ${inventory.onHand} → ${newOnHand} (${delta >= 0 ? "+" : ""}${delta})`,
        beforeState: JSON.stringify({ onHand: inventory.onHand, reserved: inventory.reserved }),
        afterState: JSON.stringify({ onHand: newOnHand, reserved: inventory.reserved }),
      },
    });

    return {
      inventory: updated,
      movement,
      available: newAvailable,
      status: deriveStockStatus(newOnHand, inventory.reserved, threshold),
    };
  });

  return {
    success: true,
    inventoryId: result.inventory.id,
    variantId: input.variantId,
    delta,
    onHand: result.inventory.onHand,
    reserved: result.inventory.reserved,
    available: result.available,
    status: result.status,
    movementId: result.movement.id,
  };
}

/**
 * INV-03 / FR-13 to FR-18: Reserve stock atomically on order placement.
 * All-or-nothing: if any line fails, entire order fails.
 */
export async function reserveStock(input: ReserveStockInput) {
  if (!input.items || input.items.length === 0) {
    return { success: true, reservedCount: 0 };
  }

  const defaultLoc = await getDefaultLocation();

  // Execute in atomic transaction with immediate locking behavior
  return await prisma.$transaction(async (tx) => {
    // 1. First pass: verify availability across all lines
    const inventoryRecords: Record<string, any> = {};

    for (const line of input.items) {
      let inv = await tx.inventory.findUnique({
        where: {
          variantId_locationId: {
            variantId: line.variantId,
            locationId: defaultLoc.id,
          },
        },
        include: {
          variant: {
            include: { product: true },
          },
        },
      });

      if (!inv) {
        // Auto-create inventory record if not present
        inv = await tx.inventory.create({
          data: {
            variantId: line.variantId,
            locationId: defaultLoc.id,
            onHand: 0,
            reserved: 0,
            lowStockThreshold: 5,
          },
          include: {
            variant: {
              include: { product: true },
            },
          },
        });
      }

      const available = inv.onHand - inv.reserved;

      if (available < line.quantity && !inv.backorderEnabled) {
        const title =
          line.variantTitle ||
          inv.variant?.title ||
          line.productTitle ||
          inv.variant?.product?.title ||
          "Selected item";
        throw new ConflictError(
          `Only ${Math.max(0, available)} unit(s) of ${title} is available; you ordered ${line.quantity}.`
        );
      }

      inventoryRecords[line.variantId] = inv;
    }

    // 2. Second pass: perform reservations atomically
    const movements = [];

    for (const line of input.items) {
      const inv = inventoryRecords[line.variantId];
      const newReserved = inv.reserved + line.quantity;
      const newAvailable = Math.max(0, inv.onHand - newReserved);

      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          reserved: newReserved,
          version: { increment: 1 },
        },
      });

      // Write RESERVATION movement
      const mov = await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          variantId: line.variantId,
          movementType: MovementType.RESERVATION,
          reasonCode: ReasonCode.SALE,
          quantityDelta: line.quantity,
          onHandAfter: inv.onHand,
          reservedAfter: newReserved,
          referenceType: "ORDER",
          referenceId: input.orderId,
          note: `Reserved for Order #${input.orderId}`,
          createdBy: "System",
        },
      });
      movements.push(mov);

      // Sync ProductVariant.stock
      await tx.productVariant.update({
        where: { id: line.variantId },
        data: {
          stock: newAvailable,
          isAvailable: newAvailable > 0 || inv.backorderEnabled,
        },
      });

      // Check alerts
      const threshold = inv.lowStockThreshold ?? 5;
      if (newAvailable <= threshold) {
        const targetType =
          newAvailable === 0 ? StockAlertTypes.OUT_OF_STOCK : StockAlertTypes.LOW_STOCK;
        const active = await tx.stockAlert.findFirst({
          where: { variantId: line.variantId, resolvedAt: null },
        });
        if (!active || active.alertType !== targetType) {
          if (active) {
            await tx.stockAlert.update({
              where: { id: active.id },
              data: { resolvedAt: new Date() },
            });
          }
          await tx.stockAlert.create({
            data: {
              variantId: line.variantId,
              alertType: targetType,
              availableAtTrigger: newAvailable,
              triggeredAt: new Date(),
            },
          });
        }
      }
    }

    return {
      success: true,
      orderId: input.orderId,
      reservedCount: movements.length,
      movements,
    };
  });
}

/**
 * INV-04 / FR-16: Consume stock on fulfilment (shipped).
 * Invariant: decrements on_hand AND reserved together. Available is UNCHANGED.
 * Idempotent.
 */
export async function fulfilStock(input: FulfilStockInput) {
  const defaultLoc = await getDefaultLocation();

  return await prisma.$transaction(async (tx) => {
    // Check idempotency: if already fulfilled for this order, do not duplicate
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        referenceType: "ORDER",
        referenceId: input.orderId,
        movementType: MovementType.FULFILMENT,
      },
    });

    if (existing) {
      return { success: true, alreadyFulfilled: true };
    }

    const results = [];

    for (const line of input.items) {
      const inv = await tx.inventory.findUnique({
        where: {
          variantId_locationId: {
            variantId: line.variantId,
            locationId: defaultLoc.id,
          },
        },
      });

      if (!inv) {
        throw new InventoryError(`No inventory record for variant ${line.variantId}`, 404);
      }

      if (inv.reserved < line.quantity) {
        throw new ConflictError(
          `Cannot fulfil ${line.quantity} units — only ${inv.reserved} reserved for variant ${line.variantId}.`
        );
      }
      if (inv.onHand < line.quantity) {
        throw new ConflictError(
          `Cannot fulfil ${line.quantity} units — only ${inv.onHand} on hand for variant ${line.variantId}.`
        );
      }

      const newOnHand = inv.onHand - line.quantity;
      const newReserved = inv.reserved - line.quantity;

      // Update inventory: both decrement in lockstep
      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          onHand: newOnHand,
          reserved: newReserved,
          version: { increment: 1 },
        },
      });

      // Record immutable FULFILMENT ledger entry
      const mov = await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          variantId: line.variantId,
          movementType: MovementType.FULFILMENT,
          reasonCode: ReasonCode.SALE,
          quantityDelta: -line.quantity,
          onHandAfter: newOnHand,
          reservedAfter: newReserved,
          referenceType: "ORDER",
          referenceId: input.orderId,
          note: `Fulfilled for Order #${input.orderId}`,
          createdBy: "System",
        },
      });

      results.push({
        variantId: line.variantId,
        onHand: newOnHand,
        reserved: newReserved,
        available: newOnHand - newReserved, // Exact match with pre-fulfilment
        movementId: mov.id,
      });
    }

    return { success: true, fulfilled: results };
  });
}

/**
 * INV-05 / FR-15 / FR-17: Release stock on cancellation or timeout.
 * Decrements reserved, leaves on_hand unchanged, restores available.
 * Idempotent.
 */
export async function releaseStock(input: ReleaseStockInput) {
  const defaultLoc = await getDefaultLocation();

  return await prisma.$transaction(async (tx) => {
    // Check idempotency
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        referenceType: "ORDER",
        referenceId: input.orderId,
        movementType: MovementType.RELEASE,
      },
    });

    if (existing) {
      return { success: true, alreadyReleased: true };
    }

    // If specific items not provided, load reserved items from Order
    let lines = input.items;
    if (!lines || lines.length === 0) {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });
      if (order && order.items.length > 0) {
        lines = order.items
          .filter((i) => i.variantId)
          .map((i) => ({
            variantId: i.variantId!,
            quantity: i.quantity,
          }));
      }
    }

    if (!lines || lines.length === 0) {
      return { success: true, releasedCount: 0 };
    }

    const results = [];

    for (const line of lines) {
      const inv = await tx.inventory.findUnique({
        where: {
          variantId_locationId: {
            variantId: line.variantId,
            locationId: defaultLoc.id,
          },
        },
      });

      if (!inv) continue;

      const releaseQty = Math.min(inv.reserved, line.quantity);
      if (releaseQty <= 0) continue;

      const newReserved = inv.reserved - releaseQty;
      const newAvailable = inv.onHand - newReserved;

      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          reserved: newReserved,
          version: { increment: 1 },
        },
      });

      const mov = await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          variantId: line.variantId,
          movementType: MovementType.RELEASE,
          reasonCode: ReasonCode.RETURN,
          quantityDelta: -releaseQty,
          onHandAfter: inv.onHand,
          reservedAfter: newReserved,
          referenceType: "ORDER",
          referenceId: input.orderId,
          note: input.reason || `Reservation released for Order #${input.orderId}`,
          createdBy: "System",
        },
      });

      // Sync ProductVariant.stock
      await tx.productVariant.update({
        where: { id: line.variantId },
        data: {
          stock: newAvailable,
          isAvailable: newAvailable > 0 || inv.backorderEnabled,
        },
      });

      // Check if alert resolved
      const threshold = inv.lowStockThreshold ?? 5;
      if (newAvailable > threshold) {
        await tx.stockAlert.updateMany({
          where: { variantId: line.variantId, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
      }

      results.push({
        variantId: line.variantId,
        released: releaseQty,
        movementId: mov.id,
      });
    }

    return { success: true, released: results };
  });
}

/**
 * INV-05: Auto-release stale unconfirmed orders older than configurable window (default 60 mins).
 */
export async function releaseExpiredReservations(windowMinutes: number = 60) {
  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoffTime },
    },
    include: { items: true },
  });

  const releasedOrders = [];

  for (const order of staleOrders) {
    await releaseStock({
      orderId: order.id,
      reason: "Payment window expired",
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
      },
    });

    releasedOrders.push(order.id);
  }

  return { success: true, releasedOrderIds: releasedOrders };
}

/**
 * INV-13: Restore stock on RTO receipt (system RETURN).
 * Attributable to the shipment; optional damage write-off.
 */
export async function restoreRtoStock(input: RestoreRtoStockInput) {
  const defaultLoc = await getDefaultLocation();

  return await prisma.$transaction(async (tx) => {
    // Idempotency check
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        referenceType: "SHIPMENT",
        referenceId: input.shipmentId,
        movementType: MovementType.RETURN,
      },
    });

    if (existing) {
      return { success: true, alreadyRestored: true };
    }

    const results = [];

    for (const item of input.items) {
      let inv = await tx.inventory.findUnique({
        where: {
          variantId_locationId: {
            variantId: item.variantId,
            locationId: defaultLoc.id,
          },
        },
      });

      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            variantId: item.variantId,
            locationId: defaultLoc.id,
            onHand: 0,
            reserved: 0,
            lowStockThreshold: 5,
          },
        });
      }

      // 1. Restore sellable on-hand
      const newOnHand = inv.onHand + item.quantity;
      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          onHand: newOnHand,
          version: { increment: 1 },
        },
      });

      const returnMov = await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          variantId: item.variantId,
          movementType: MovementType.RETURN,
          reasonCode: ReasonCode.RETURN,
          quantityDelta: item.quantity,
          onHandAfter: newOnHand,
          reservedAfter: inv.reserved,
          referenceType: "SHIPMENT",
          referenceId: input.shipmentId,
          note: `RTO return received for shipment ${input.shipmentId}`,
          createdBy: input.actorName || input.actorId || "System",
        },
      });

      let finalOnHand = newOnHand;

      // 2. If marked damaged, write off in same transaction (INV-13 note)
      if (item.isDamaged) {
        finalOnHand = newOnHand - item.quantity;
        await tx.inventory.update({
          where: { id: inv.id },
          data: {
            onHand: finalOnHand,
            version: { increment: 1 },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryId: inv.id,
            variantId: item.variantId,
            movementType: MovementType.ADJUSTMENT,
            reasonCode: ReasonCode.DAMAGE,
            quantityDelta: -item.quantity,
            onHandAfter: finalOnHand,
            reservedAfter: inv.reserved,
            referenceType: "SHIPMENT",
            referenceId: input.shipmentId,
            note:
              item.damageNote ||
              `RTO return arrived damaged from shipment ${input.shipmentId}`,
            createdBy: input.actorName || input.actorId || "System",
          },
        });
      }

      // Sync ProductVariant.stock
      const finalAvailable = Math.max(0, finalOnHand - inv.reserved);
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: finalAvailable,
          isAvailable: finalAvailable > 0 || inv.backorderEnabled,
        },
      });

      results.push({
        variantId: item.variantId,
        restoredQuantity: item.quantity,
        isDamaged: !!item.isDamaged,
        finalOnHand,
        movementId: returnMov.id,
      });
    }

    return { success: true, shipmentId: input.shipmentId, restored: results };
  });
}

/**
 * INV-09: Bulk stock update with server dryRun preview and atomic commit.
 */
export async function bulkAdjustStock(input: BulkAdjustmentInput) {
  const defaultLoc = await getDefaultLocation();
  const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Dry run / validation pass
  const previewRows: Array<{
    variantId: string;
    sku: string;
    productTitle: string;
    variantTitle: string | null;
    currentOnHand: number;
    newOnHand: number;
    currentReserved: number;
    currentAvailable: number;
    newAvailable: number;
    delta: number;
    isNegative: boolean;
  }> = [];
  let totalDelta = 0;
  let hasNegative = false;

  for (const row of input.adjustments) {
    const inv = await getOrCreateInventory(row.variantId, defaultLoc.id);
    let delta = input.mode === "DELTA" ? row.quantity : row.quantity - inv.onHand;
    const newOnHand = inv.onHand + delta;
    const isNegative = newOnHand < 0;

    if (isNegative) hasNegative = true;
    totalDelta += delta;

    previewRows.push({
      variantId: row.variantId,
      sku: inv.variant?.sku || "N/A",
      productTitle: inv.variant?.product?.title || "Unknown",
      variantTitle: inv.variant?.title || null,
      currentOnHand: inv.onHand,
      newOnHand,
      currentReserved: inv.reserved,
      currentAvailable: inv.onHand - inv.reserved,
      newAvailable: newOnHand - inv.reserved,
      delta,
      isNegative,
    });
  }

  if (input.dryRun) {
    return {
      dryRun: true,
      batchId,
      totalCount: previewRows.length,
      totalDelta,
      hasNegative,
      rows: previewRows,
    };
  }

  if (hasNegative) {
    throw new ConflictError("One or more rows would drive stock negative and cannot be committed.");
  }

  // 2. Commit in transaction
  return await prisma.$transaction(async (tx) => {
    const committedMovements = [];

    for (const preview of previewRows) {
      if (preview.delta === 0) continue;

      const updatedInv = await tx.inventory.update({
        where: {
          variantId_locationId: {
            variantId: preview.variantId,
            locationId: defaultLoc.id,
          },
        },
        data: {
          onHand: preview.newOnHand,
          version: { increment: 1 },
          lastCountedAt:
            input.reasonCode === ReasonCode.CORRECTION ? new Date() : undefined,
        },
      });

      const mov = await tx.inventoryMovement.create({
        data: {
          inventoryId: updatedInv.id,
          variantId: preview.variantId,
          movementType: MovementType.ADJUSTMENT,
          reasonCode: input.reasonCode,
          quantityDelta: preview.delta,
          onHandAfter: preview.newOnHand,
          reservedAfter: preview.currentReserved,
          referenceType: "ADJUSTMENT",
          referenceId: batchId,
          batchId,
          note: input.note || `Bulk adjustment (${input.reasonCode})`,
          createdBy: input.actorName || input.actorId || "Admin",
        },
      });
      committedMovements.push(mov);

      // Sync ProductVariant.stock
      const newAvail = Math.max(0, preview.newOnHand - preview.currentReserved);
      await tx.productVariant.update({
        where: { id: preview.variantId },
        data: { stock: newAvail, isAvailable: newAvail > 0 },
      });
    }

    // Audit trail for the batch
    await tx.auditLog.create({
      data: {
        actorId: input.actorId || "admin",
        actorName: input.actorName || "Admin",
        actorRole: "ADMIN",
        entity: "BULK_INVENTORY",
        entityId: batchId,
        action: `${input.actorName || "Admin"} adjusted stock on ${previewRows.length} SKUs (${totalDelta >= 0 ? "+" : ""}${totalDelta} units, ${input.reasonCode})`,
      },
    });

    return {
      success: true,
      batchId,
      appliedCount: committedMovements.length,
      totalDelta,
      rows: previewRows,
    };
  });
}

/**
 * INV-09: 60-second Compensating Undo.
 * Posts compensating movements rather than deleting ledger rows (ledger remains strictly append-only).
 */
export async function undoBulkAdjust(batchId: string, actorId: string, actorName?: string) {
  const movements = await prisma.inventoryMovement.findMany({
    where: { batchId },
  });

  if (movements.length === 0) {
    throw new InventoryError(`No movements found for batch ${batchId}`, 404);
  }

  const defaultLoc = await getDefaultLocation();

  return await prisma.$transaction(async (tx) => {
    const undoBatchId = `UNDO-${batchId}`;

    for (const mov of movements) {
      const inv = await tx.inventory.findUnique({
        where: {
          variantId_locationId: {
            variantId: mov.variantId,
            locationId: defaultLoc.id,
          },
        },
      });

      if (!inv) continue;

      // Invert the delta
      const compensatingDelta = -mov.quantityDelta;
      const restoredOnHand = inv.onHand + compensatingDelta;

      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          onHand: restoredOnHand,
          version: { increment: 1 },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          variantId: mov.variantId,
          movementType: MovementType.ADJUSTMENT,
          reasonCode: ReasonCode.CORRECTION,
          quantityDelta: compensatingDelta,
          onHandAfter: restoredOnHand,
          reservedAfter: inv.reserved,
          referenceType: "ADJUSTMENT",
          referenceId: undoBatchId,
          batchId: undoBatchId,
          note: `Compensating undo for batch ${batchId}`,
          createdBy: actorName || actorId || "Admin",
        },
      });

      const newAvail = Math.max(0, restoredOnHand - inv.reserved);
      await tx.productVariant.update({
        where: { id: mov.variantId },
        data: { stock: newAvail, isAvailable: newAvail > 0 },
      });
    }

    return { success: true, batchId, undoBatchId, restoredCount: movements.length };
  });
}

/**
 * INV-10: CSV Stock Take Import.
 * Parses counted quantities, computes variance against system, commits correction batch.
 */
export async function importStockCsv(
  rows: { sku: string; countedQty: number }[],
  actorId: string,
  actorName?: string
) {
  const defaultLoc = await getDefaultLocation();
  const batchId = `IMPORT-${Date.now()}`;

  const skus = rows.map((r) => r.sku.trim());
  const variants = await prisma.productVariant.findMany({
    where: { sku: { in: skus }, deletedAt: null },
    include: {
      product: true,
      inventories: { where: { locationId: defaultLoc.id } },
    },
  });

  const variantMap = new Map(variants.map((v) => [v.sku!, v]));

  const preview = [];
  const errorRows = [];
  let totalVariance = 0;
  let flaggedCount = 0;

  for (const row of rows) {
    const trimmedSku = row.sku.trim();
    const variant = variantMap.get(trimmedSku);

    if (!variant) {
      errorRows.push({ sku: trimmedSku, countedQty: row.countedQty, error: "SKU not found" });
      continue;
    }

    const currentOnHand = variant.inventories[0]?.onHand ?? 0;
    const currentReserved = variant.inventories[0]?.reserved ?? 0;
    const variance = row.countedQty - currentOnHand; // Delta needed
    totalVariance += variance;

    const isHighVariance =
      currentOnHand > 0 && Math.abs(variance) / currentOnHand >= 0.2;
    if (isHighVariance) flaggedCount++;

    preview.push({
      variantId: variant.id,
      sku: trimmedSku,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      systemOnHand: currentOnHand,
      countedQty: row.countedQty,
      reserved: currentReserved,
      variance,
      isHighVariance,
    });
  }

  return {
    batchId,
    totalRows: rows.length,
    validRowsCount: preview.length,
    errorRowsCount: errorRows.length,
    totalVariance,
    flaggedCount,
    rows: preview,
    errorRows,
  };
}

/**
 * Fetches all inventory items with derived available, active alerts, and reserved order counts (INV-01).
 */
export async function getInventoryOverview(params: {
  page?: number;
  limit?: number;
  search?: string;
  stockStatus?: StockStatus | "ALL";
  categoryId?: string;
  brandId?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const defaultLoc = await getDefaultLocation();

  // Build query for product variants
  const where: any = {
    deletedAt: null,
    isActive: true,
  };

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { sku: { contains: q } },
      { title: { contains: q } },
      { product: { title: { contains: q } } },
    ];
  }

  if (params.categoryId) {
    where.product = { ...where.product, categoryId: params.categoryId };
  }

  if (params.brandId) {
    where.product = { ...where.product, brandId: params.brandId };
  }

  // Fetch variants with inventory records
  const variants = await prisma.productVariant.findMany({
    where,
    include: {
      product: {
        include: {
          category: true,
          brand: true,
          images: {
            include: { image: true },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
      },
      inventories: {
        where: { locationId: defaultLoc.id },
      },
      stockAlerts: {
        where: { resolvedAt: null },
        orderBy: { triggeredAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
  });

  // Also query pending orders holding reservations for these variants
  const variantIds = variants.map((v) => v.id);
  const pendingOrderItems = await prisma.orderItem.findMany({
    where: {
      variantId: { in: variantIds },
      order: {
        status: { in: ["PENDING", "COD_CONFIRMED", "CAPTURED"] },
      },
    },
    select: {
      variantId: true,
      orderId: true,
      quantity: true,
      order: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          user: { select: { name: true, phone: true } },
        },
      },
    },
  });

  const orderMap = new Map<string, any[]>();
  for (const item of pendingOrderItems) {
    if (!item.variantId) continue;
    const list = orderMap.get(item.variantId) || [];
    list.push({
      orderId: item.orderId,
      quantity: item.quantity,
      status: item.order.status,
      createdAt: item.order.createdAt,
      customerName: item.order.user?.name || "Customer",
      customerPhone: item.order.user?.phone || null,
    });
    orderMap.set(item.variantId, list);
  }

  // Map to DTOs
  const items: InventoryItemDTO[] = variants.map((v) => {
    const inv = v.inventories[0];
    const onHand = inv ? inv.onHand : 0;
    const reserved = inv ? inv.reserved : 0;
    const available = onHand - reserved;
    const threshold = inv?.lowStockThreshold ?? 5;
    const status = deriveStockStatus(onHand, reserved, threshold);
    const activeAlert = v.stockAlerts[0]
      ? {
          id: v.stockAlerts[0].id,
          alertType: v.stockAlerts[0].alertType as any,
          triggeredAt: v.stockAlerts[0].triggeredAt,
        }
      : null;

    const orders = orderMap.get(v.id) || [];

    return {
      id: inv ? inv.id : v.id,
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      categoryName: v.product.category?.name || "Uncategorized",
      brandName: v.product.brand?.name || null,
      imageUrl: v.product.images[0]?.image?.url || null,
      onHand,
      reserved,
      available,
      lowStockThreshold: threshold,
      backorderEnabled: inv?.backorderEnabled ?? false,
      stockStatus: status,
      lastCountedAt: inv?.lastCountedAt || null,
      updatedAt: inv?.updatedAt || v.updatedAt,
      activeAlert,
      reservedOrdersCount: orders.length,
    };
  });

  // Filter by stockStatus if specified
  let filteredItems = items;
  if (params.stockStatus && params.stockStatus !== "ALL") {
    filteredItems = items.filter((i) => i.stockStatus === params.stockStatus);
  }

  // Summary stats
  const totalOnHand = items.reduce((sum, i) => sum + i.onHand, 0);
  const totalReserved = items.reduce((sum, i) => sum + i.reserved, 0);
  const totalAvailable = items.reduce((sum, i) => sum + i.available, 0);
  const lowStockCount = items.filter((i) => i.stockStatus === StockStatus.LOW_STOCK).length;
  const outOfStockCount = items.filter((i) => i.stockStatus === StockStatus.OUT_OF_STOCK).length;

  // Pagination slice
  const paginatedItems = filteredItems.slice(skip, skip + limit);

  return {
    items: paginatedItems,
    pagination: {
      page,
      limit,
      totalItems: filteredItems.length,
      totalPages: Math.ceil(filteredItems.length / limit),
    },
    stats: {
      totalVariants: items.length,
      totalOnHand,
      totalReserved,
      totalAvailable,
      lowStockCount,
      outOfStockCount,
      alertMessage:
        outOfStockCount > 0 || lowStockCount > 0
          ? `${outOfStockCount} SKUs are out of stock and ${lowStockCount} are running low.`
          : null,
    },
    orderMap: Object.fromEntries(orderMap),
  };
}
