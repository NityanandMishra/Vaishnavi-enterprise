"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "progress"
  | "success"
  | "warning"
  | "danger";

interface StatusBadgeProps {
  status?: string;
  variant?: BadgeVariant;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const STATUS_VARIANT_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  // Neutral / Draft
  DRAFT: { variant: "neutral", label: "Draft" },
  UNPUBLISHED: { variant: "neutral", label: "Unpublished" },
  INACTIVE: { variant: "neutral", label: "Inactive" },
  ARCHIVED: { variant: "neutral", label: "Archived" },

  // In Progress
  PENDING: { variant: "progress", label: "Pending" },
  PROCESSING: { variant: "progress", label: "Processing" },
  PACKED: { variant: "progress", label: "Packed" },
  READY_TO_SHIP: { variant: "progress", label: "Ready to Ship" },
  IN_TRANSIT: { variant: "progress", label: "In Transit" },
  DISPATCHED: { variant: "progress", label: "Dispatched" },
  OUT_FOR_DELIVERY: { variant: "progress", label: "Out for Delivery" },
  CONTACTED: { variant: "progress", label: "Contacted" },
  QUOTED: { variant: "progress", label: "Quoted" },
  NEW: { variant: "progress", label: "New" },

  // Success / Terminal Good
  ACTIVE: { variant: "success", label: "Active" },
  PAID: { variant: "success", label: "Paid" },
  CAPTURED: { variant: "success", label: "Paid" },
  COD_CONFIRMED: { variant: "success", label: "COD Confirmed" },
  FULFILLED: { variant: "success", label: "Fulfilled" },
  DELIVERED: { variant: "success", label: "Delivered" },
  IN_STOCK: { variant: "success", label: "In Stock" },
  CLOSED_WON: { variant: "success", label: "Closed Won" },
  COLLECTED: { variant: "success", label: "Collected" },
  REMITTED: { variant: "success", label: "Remitted" },
  RECONCILED: { variant: "success", label: "Reconciled" },
  RESOLVED: { variant: "success", label: "Resolved" },
  COMPLETED: { variant: "success", label: "Completed" },
  APPROVED: { variant: "progress", label: "Approved" },

  // Warning / Needs Attention
  LOW_STOCK: { variant: "warning", label: "Low Stock" },
  PAYMENT_PENDING: { variant: "warning", label: "Payment Pending" },
  PARTIALLY_SHIPPED: { variant: "warning", label: "Partially Shipped" },
  PARTIALLY_REFUNDED: { variant: "warning", label: "Partially Refunded" },
  PARTIALLY_PAID: { variant: "warning", label: "Partially Paid" },
  REQUESTED: { variant: "warning", label: "Awaiting Approval" },
  OPEN: { variant: "warning", label: "Open" },

  // Danger / Terminal Bad
  OUT_OF_STOCK: { variant: "danger", label: "Out of Stock" },
  CANCELLED: { variant: "danger", label: "Cancelled" },
  FAILED: { variant: "danger", label: "Failed" },
  FAILED_DELIVERY: { variant: "danger", label: "Delivery Failed" },
  RTO: { variant: "danger", label: "RTO" },
  REFUNDED: { variant: "danger", label: "Refunded" },
  REJECTED: { variant: "danger", label: "Rejected" },
  DISCREPANCY: { variant: "danger", label: "Discrepancy" },
  CLOSED_LOST: { variant: "danger", label: "Closed Lost" },
  EXPIRED: { variant: "neutral", label: "Expired" },
  IGNORED: { variant: "neutral", label: "Ignored" },
};

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
  neutral: {
    bg: "bg-[var(--gray-100)]",
    text: "text-[var(--gray-700)]",
    dot: "bg-[var(--gray-500)]",
    border: "border-[var(--gray-200)]",
  },
  progress: {
    bg: "bg-[var(--violet-50)]",
    text: "text-[var(--violet-600)]",
    dot: "bg-[var(--violet-600)]",
    border: "border-[var(--violet-50)]",
  },
  success: {
    bg: "bg-[var(--green-50)]",
    text: "text-[var(--green-700)]",
    dot: "bg-[var(--green-600)]",
    border: "border-[var(--green-50)]",
  },
  warning: {
    bg: "bg-[var(--amber-50)]",
    text: "text-[var(--amber-700)]",
    dot: "bg-[var(--amber-600)]",
    border: "border-[var(--amber-50)]",
  },
  danger: {
    bg: "bg-[var(--red-50)]",
    text: "text-[var(--red-700)]",
    dot: "bg-[var(--red-600)]",
    border: "border-[var(--red-50)]",
  },
};

export default function StatusBadge({
  status,
  variant: explicitVariant,
  label: explicitLabel,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const mapped = status ? STATUS_VARIANT_MAP[status.toUpperCase()] : null;
  const variant: BadgeVariant = explicitVariant ?? mapped?.variant ?? "neutral";
  const displayLabel = explicitLabel ?? mapped?.label ?? status?.replace(/_/g, " ") ?? "Unknown";

  const styles = VARIANT_STYLES[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[var(--text-xs)] font-medium px-2 py-[2px] rounded-[var(--radius-full)] border tracking-normal whitespace-nowrap select-none",
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", styles.dot)}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
