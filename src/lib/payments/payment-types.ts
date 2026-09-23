/**
 * Vaishnavi Enterprise — Payment Management (PAY) Types & Enums
 * Epic: EPIC-06 (PAY)
 *
 * All amounts handled as integer paise end-to-end (D-07, NFR-05).
 */

export type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED"
  | "EXPIRED";

export type RefundStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";

export type PaymentMethod =
  | "UPI"
  | "COD"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "BANK_TRANSFER"
  | "CASH";

export type GatewayType = "RAZORPAY" | "PAYU" | "CASHFREE" | "MANUAL" | "COD";

export type RefundReasonCode =
  | "ORDER_CANCELLED"
  | "OUT_OF_STOCK"
  | "DAMAGED_ON_ARRIVAL"
  | "WRONG_ITEM_SENT"
  | "CUSTOMER_REQUEST"
  | "DUPLICATE_PAYMENT"
  | "OTHER";

export const REFUND_REASON_LABELS: Record<RefundReasonCode, string> = {
  ORDER_CANCELLED: "Order cancelled",
  OUT_OF_STOCK: "Item out of stock",
  DAMAGED_ON_ARRIVAL: "Damaged on arrival",
  WRONG_ITEM_SENT: "Wrong item sent",
  CUSTOMER_REQUEST: "Customer request",
  DUPLICATE_PAYMENT: "Duplicate payment",
  OTHER: "Other",
};

export type CodCollectionStatus =
  | "PENDING"
  | "COLLECTED"
  | "REMITTED"
  | "DISCREPANCY";

export type MismatchType =
  | "IN_GATEWAY_NOT_PLATFORM"
  | "IN_PLATFORM_NOT_GATEWAY"
  | "AMOUNT_MISMATCH"
  | "STATUS_MISMATCH";

export type ReconciliationStatus = "OPEN" | "RESOLVED" | "IGNORED";

// ─── DTOs & INPUTS ───────────────────────────────────────────────────────────

export interface RecordTransactionInput {
  orderId: string;
  gateway?: GatewayType | string;
  gatewayTransactionId?: string;
  gatewayOrderId?: string;
  method: PaymentMethod | string;
  amountPaise: number;
  status: PaymentStatus;
  gatewayResponseCode?: string;
  gatewayResponseMessage?: string;
  cardLastFour?: string; // SEC-01: Gateway-provided only, never full PAN
  upiVpaMasked?: string;
  bankName?: string;
  initiatedAt?: Date;
  completedAt?: Date;
  rawPayload?: Record<string, any> | string;
  gatewayEventId?: string;
  signatureVerified?: boolean;
}

export interface RefundableItemLine {
  orderItemId: string;
  productName: string;
  variantTitle?: string;
  sku?: string;
  quantity: number;
  unitPricePaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  lineTotalPaise: number;
}

export interface RefundableBreakdown {
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus | string;
  paidPaise: number;
  alreadyRefundedPaise: number;
  refundablePaise: number;
  shippingPaise: number;
  discountPaise: number;
  items: RefundableItemLine[];
  taxComponentPaise: number; // Proportional reclaimable GST on max refundable
  isCod: boolean;
  approvalThresholdPaise: number;
}

export interface InitiateRefundInput {
  orderId: string;
  amountPaise: number;
  reasonCode: RefundReasonCode | string;
  note?: string;
  lineIds?: string[]; // If by item
  method?: "gateway" | "bank_transfer" | "upi" | "cash";
  referenceNumber?: string; // Mandatory for COD / manual refunds
  userId?: string;
  userName?: string;
  userRole?: string;
}

export interface ApproveRefundInput {
  refundId: string;
  userId: string;
  userName: string;
  userRole: string;
  note?: string;
}

export interface RejectRefundInput {
  refundId: string;
  userId: string;
  userName: string;
  userRole: string;
  reason: string;
}

export interface CodRemittanceInput {
  courierId: string;
  periodStart?: Date;
  periodEnd?: Date;
  expectedPaise: number;
  receivedPaise: number;
  bankReference?: string;
  note?: string;
  orderIds?: string[]; // Orders covered by this remittance
  userId?: string;
  userName?: string;
}

export interface SettlementImportRow {
  gatewayTransactionId: string;
  orderNumber?: string;
  amountPaise: number;
  status: string;
  feePaise?: number;
  taxOnFeePaise?: number;
  date?: string;
}

export interface SettlementImportInput {
  gateway: "RAZORPAY" | "PAYU" | "CASHFREE" | string;
  settlementId: string;
  settlementDate: Date;
  bankReference?: string;
  grossPaise: number;
  feesPaise: number;
  taxOnFeesPaise: number;
  netPaise: number;
  transactions: SettlementImportRow[];
  userId?: string;
  userName?: string;
}

export interface PaymentDashboardSummary {
  collectedThisMonthPaise: number;
  collectedCount: number;
  pendingPaise: number;
  pendingCount: number;
  refundedThisMonthPaise: number;
  refundedCount: number;
  codDuePaise: number;
  codDueCount: number;
  methodBreakdown: {
    method: string;
    label: string;
    percentage: number;
    amountPaise: number;
    count: number;
  }[];
  attentionStrips: {
    id: string;
    severity: "danger" | "warning";
    message: string;
    count: number;
    amountPaise?: number;
    actionLabel: string;
    actionHref: string;
  }[];
}

export interface PaymentFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  method?: string;
  gateway?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
}
