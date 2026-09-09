import { z } from "zod";

export const MovementType = {
  ADJUSTMENT: "ADJUSTMENT",
  RESERVATION: "RESERVATION",
  RELEASE: "RELEASE",
  FULFILMENT: "FULFILMENT",
  RETURN: "RETURN",
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const ReasonCode = {
  PURCHASE: "PURCHASE",
  SALE: "SALE",
  RETURN: "RETURN",
  DAMAGE: "DAMAGE",
  THEFT: "THEFT",
  CORRECTION: "CORRECTION",
  TRANSFER: "TRANSFER",
} as const;
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

export const ManualReasonCodes = [
  ReasonCode.PURCHASE,
  ReasonCode.RETURN,
  ReasonCode.DAMAGE,
  ReasonCode.THEFT,
  ReasonCode.CORRECTION,
  ReasonCode.TRANSFER,
] as const;

export const StockStatus = {
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;
export type StockStatus = (typeof StockStatus)[keyof typeof StockStatus];

export const StockAlertTypes = {
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;
export type StockAlertType = (typeof StockAlertTypes)[keyof typeof StockAlertTypes];

export interface InventoryItemDTO {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  categoryName: string;
  brandName: string | null;
  imageUrl: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  backorderEnabled: boolean;
  stockStatus: StockStatus;
  lastCountedAt: Date | null;
  updatedAt: Date;
  activeAlert: {
    id: string;
    alertType: StockAlertType;
    triggeredAt: Date;
  } | null;
  reservedOrdersCount: number;
}

export interface StockAdjustmentInput {
  variantId: string;
  mode: "DELTA" | "ABSOLUTE";
  quantity: number; // In DELTA mode: signed delta; In ABSOLUTE mode: target on-hand
  reasonCode: ReasonCode;
  note?: string;
  actorId: string;
  actorName?: string;
  confirmLarge?: boolean;
}

export interface BulkAdjustmentRow {
  variantId: string;
  quantity: number;
}

export interface BulkAdjustmentInput {
  adjustments: BulkAdjustmentRow[];
  mode: "DELTA" | "ABSOLUTE";
  reasonCode: ReasonCode;
  note?: string;
  actorId: string;
  actorName?: string;
  dryRun?: boolean;
}

export interface ReservationLine {
  variantId: string;
  quantity: number;
  productTitle?: string;
  variantTitle?: string | null;
  sku?: string | null;
}

export interface ReserveStockInput {
  orderId: string;
  items: ReservationLine[];
}

export interface FulfilStockInput {
  orderId: string;
  items: ReservationLine[];
  idempotencyKey?: string;
}

export interface ReleaseStockInput {
  orderId: string;
  items?: ReservationLine[];
  reason?: string;
}

export interface RtoReturnLine {
  variantId: string;
  quantity: number;
  isDamaged?: boolean;
  damageNote?: string;
}

export interface RestoreRtoStockInput {
  shipmentId: string;
  items: RtoReturnLine[];
  actorId: string;
  actorName?: string;
}

export const AdjustStockSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  mode: z.enum(["DELTA", "ABSOLUTE"]),
  quantity: z.number().int("Quantity must be an integer"),
  reasonCode: z.enum([
    ReasonCode.PURCHASE,
    ReasonCode.RETURN,
    ReasonCode.DAMAGE,
    ReasonCode.THEFT,
    ReasonCode.CORRECTION,
    ReasonCode.TRANSFER,
  ]),
  note: z.string().optional(),
  confirmLarge: z.boolean().optional(),
});
