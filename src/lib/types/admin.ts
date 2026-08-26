/**
 * Vaishnavi Enterprise — Admin Portal Shared Types & Enums
 * Foundation Spec: 00 (Sections 1, 2, 8)
 */

// ─── 2. USERS & ROLES ────────────────────────────────────────────────────────
export type UserRole =
  | "SUPER_ADMIN"
  | "CATALOG_MANAGER"
  | "OPS_EXECUTIVE"
  | "FINANCE"
  | "CUSTOMER"
  | "ADMIN"; // backwards compatibility for existing seed

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CATALOG_MANAGER: "Catalog Manager",
  OPS_EXECUTIVE: "Ops Executive",
  FINANCE: "Finance & Accounts",
  ADMIN: "Super Admin",
  CUSTOMER: "Customer",
};

export const ROLE_BADGE_STYLE: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: "var(--violet-50)", text: "var(--violet-600)" },
  CATALOG_MANAGER: { bg: "var(--blue-50)", text: "var(--blue-700)" },
  OPS_EXECUTIVE: { bg: "var(--amber-50)", text: "var(--amber-700)" },
  FINANCE: { bg: "var(--green-50)", text: "var(--green-700)" },
  ADMIN: { bg: "var(--violet-50)", text: "var(--violet-600)" },
};

// ─── 8. SHARED ENUMS ─────────────────────────────────────────────────────────

export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED"
  | "CAPTURED" // legacy
  | "COD_CONFIRMED" // legacy
  | "FULFILLED"; // legacy

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export type PaymentMethod =
  | "UPI"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "COD"
  | "RAZORPAY"
  | "RAZORPAY_CARD"
  | "RAZORPAY_NB";

export type ShipmentStatus =
  | "PENDING"
  | "READY_TO_SHIP"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_DELIVERY"
  | "RTO";

export type AdjustmentReason =
  | "PURCHASE"
  | "SALE"
  | "RETURN"
  | "DAMAGE"
  | "THEFT"
  | "CORRECTION"
  | "TRANSFER";

// ─── AUDIT RECORD ────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  entity: string;
  entityId: string;
  action: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  timestamp: string | Date;
  ipAddress?: string;
}

// ─── PERMISSION UTILITY ──────────────────────────────────────────────────────

export function canPerformAction(
  role: UserRole | string | undefined,
  action:
    | "manage_settings"
    | "manage_tax"
    | "issue_refund"
    | "manage_catalog"
    | "manage_inventory"
    | "manage_orders"
    | "manage_shipping"
    | "view_finances"
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;

  switch (action) {
    case "manage_catalog":
      return role === "CATALOG_MANAGER";
    case "manage_inventory":
      return role === "CATALOG_MANAGER" || role === "OPS_EXECUTIVE";
    case "manage_orders":
    case "manage_shipping":
      return role === "OPS_EXECUTIVE";
    case "view_finances":
    case "issue_refund":
    case "manage_tax":
      return role === "FINANCE";
    case "manage_settings":
      return role === "SUPER_ADMIN" || role === "ADMIN";
    default:
      return false;
  }
}
