// ─── EPIC-05: ORDER MANAGEMENT TYPES & STATE MACHINE ─────────────────────────

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "REFUND_DUE"
  | "REFUNDED"
  | "FAILED";

export type OrderSource = "WEB" | "MANUAL" | "PHONE";

export type PaymentMethod =
  | "COD"
  | "UPI"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "BANK_TRANSFER"
  | "CASH"
  | "RAZORPAY";

export type LineStatus = "ACTIVE" | "CANCELLED";

export type LineAdjustmentType = "CANCELLATION" | "DISCOUNT";

/**
 * A.4 Order Status Pipeline Transition Rules
 * This is an enforced state machine. Transitions not defined here are illegal.
 */
export interface TransitionRule {
  legalNext: OrderStatus[];
  systemOnlyNext: OrderStatus[];
  requiresReason?: OrderStatus[];
}

export const ORDER_TRANSITIONS: Record<OrderStatus, TransitionRule> = {
  PENDING: {
    legalNext: ["CONFIRMED", "CANCELLED"],
    systemOnlyNext: [],
  },
  CONFIRMED: {
    legalNext: ["PROCESSING", "CANCELLED"],
    systemOnlyNext: [],
  },
  PROCESSING: {
    // Backward transition to CONFIRMED allowed only with a reason
    legalNext: ["PACKED", "CONFIRMED", "CANCELLED"],
    systemOnlyNext: [],
    requiresReason: ["CONFIRMED"],
  },
  PACKED: {
    // SHIPPED is system-only: fired exclusively by shipment dispatch (Module 07)
    // Backward transition to PROCESSING allowed only with a reason
    legalNext: ["SHIPPED", "PROCESSING", "CANCELLED"],
    systemOnlyNext: ["SHIPPED"],
    requiresReason: ["PROCESSING"],
  },
  SHIPPED: {
    // DELIVERED is system-only, RETURNED is Phase 4 (blocked in v1)
    legalNext: ["DELIVERED", "RETURNED"],
    systemOnlyNext: ["DELIVERED"],
  },
  DELIVERED: {
    // RETURNED is Phase 4 (blocked in v1)
    legalNext: ["RETURNED"],
    systemOnlyNext: [],
  },
  CANCELLED: {
    legalNext: [],
    systemOnlyNext: [],
  },
  RETURNED: {
    legalNext: [],
    systemOnlyNext: [],
  },
};

/**
 * Default status SLA in hours (ORD-10)
 */
export const DEFAULT_STATUS_SLA_HOURS: Partial<Record<OrderStatus, number>> = {
  PENDING: 2,
  CONFIRMED: 8,
  PROCESSING: 12,
  PACKED: 6,
};

/**
 * S3 / ORD-04 Fixed Cancellation Reasons
 */
export const CANCELLATION_REASONS = [
  "Customer request",
  "Out of stock",
  "Payment failed",
  "Suspected fraud",
  "Undeliverable address",
  "Duplicate order",
  "Other",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  pincode: string;
  city: string;
  state: string;
}

export interface TransitionStatusInput {
  toStatus: OrderStatus;
  reason?: string;
  note?: string;
  actor?: string;
  isSystem?: boolean;
}

export interface CancelOrderInput {
  reason: string;
  note?: string;
  actor?: string;
  notifyCustomer?: boolean;
}

export interface CancelLineInput {
  quantity?: number; // If omitted, cancels entire remaining active quantity
  reason: string;
  actor?: string;
}

export interface OrderItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice?: number; // Override price (if omitted, list price is used)
  lineDiscount?: number;
}

export interface CreateManualOrderInput {
  customer: {
    userId?: string | null;
    name: string;
    phone: string;
    email?: string | null;
  };
  items: OrderItemInput[];
  shippingAddress: ShippingAddressInput;
  billingAddress?: ShippingAddressInput | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingCharge?: number;
  orderDiscount?: number;
  customerNote?: string;
  amountReceived?: number;
  transactionRef?: string;
  actor?: string;
  source?: OrderSource;
}
