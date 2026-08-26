"use client";

import React, { useState } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Power,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Percent,
} from "lucide-react";
import {
  DataTable,
  ColumnDef,
  PageHeader,
  Modal,
  StatusBadge,
  ConfirmDialog,
  useToast,
} from "@/components/admin/ui";
import { formatINR } from "@/lib/utils";
import {
  createAdminCoupon,
  toggleCouponActive,
  deleteCoupon,
} from "@/app/admin/(authenticated)/coupons/actions";

export interface CouponItem {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export default function CouponsManager({
  coupons,
}: {
  coupons: CouponItem[];
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const toast = useToast();

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("code", code);
    formData.set("discountType", discountType);
    formData.set("discountValue", discountValue);
    formData.set("minOrderValue", minOrderValue || "0");
    if (maxDiscount) formData.set("maxDiscount", maxDiscount);
    if (usageLimit) formData.set("usageLimit", usageLimit);
    if (expiresAt) formData.set("expiresAt", expiresAt);

    try {
      const res = await createAdminCoupon(formData);
      if (res.ok) {
        toast.success("Coupon Created", `Coupon code ${code.toUpperCase()} is now live.`);
        setIsCreateModalOpen(false);
        setCode("");
        setDiscountValue("");
        setMinOrderValue("");
        setMaxDiscount("");
        setUsageLimit("");
        setExpiresAt("");
      } else {
        setFormError(res.error || "Failed to create coupon.");
      }
    } catch (_) {
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(coupon: CouponItem) {
    try {
      await toggleCouponActive(coupon.id, coupon.isActive);
      toast.info(
        "Coupon Updated",
        `Coupon ${coupon.code} ${coupon.isActive ? "deactivated" : "activated"}.`
      );
    } catch (_) {
      toast.error("Failed to update coupon status");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCoupon(deleteTarget.id);
      toast.success("Coupon Deleted", `Coupon ${deleteTarget.code} has been deleted.`);
      setDeleteTarget(null);
    } catch (_) {
      toast.error("Failed to delete coupon");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<CouponItem>[] = [
    {
      id: "code",
      header: "Coupon Code",
      accessorKey: "code",
      isMono: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[var(--color-primary)]" />
          <span className="font-bold text-[var(--color-fg)]">{row.code}</span>
        </div>
      ),
    },
    {
      id: "discount",
      header: "Discount",
      cell: (row) => (
        <span className="font-semibold text-emerald-700">
          {row.discountType === "PERCENTAGE"
            ? `${row.discountValue}% OFF`
            : `FLAT ${formatINR(row.discountValue)}`}
        </span>
      ),
    },
    {
      id: "minOrder",
      header: "Min Order",
      align: "right",
      isMono: true,
      cell: (row) => formatINR(row.minOrderValue),
    },
    {
      id: "maxCap",
      header: "Max Cap",
      align: "right",
      isMono: true,
      cell: (row) => (row.maxDiscount ? formatINR(row.maxDiscount) : "No limit"),
    },
    {
      id: "usage",
      header: "Redemptions",
      align: "center",
      isMono: true,
      cell: (row) => (
        <span className="text-[var(--text-xs)]">
          <strong>{row.usedCount}</strong> / {row.usageLimit ? row.usageLimit : "∞"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => (
        <StatusBadge
          status={row.isActive ? "ACTIVE" : "INACTIVE"}
          label={row.isActive ? "Active" : "Inactive"}
        />
      ),
    },
    {
      id: "expires",
      header: "Expiry Date",
      cell: (row) =>
        row.expiresAt ? (
          <span className="text-[var(--text-xs)] font-mono text-[var(--color-fg-muted)]">
            {new Date(row.expiresAt).toLocaleDateString("en-IN")}
          </span>
        ) : (
          <span className="text-[var(--text-xs)] text-[var(--color-fg-subtle)]">Never</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            title={row.isActive ? "Deactivate Coupon" : "Activate Coupon"}
            className="w-7 h-7 rounded flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <Power size={14} className={row.isActive ? "text-emerald-600" : "text-slate-400"} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            title="Delete Coupon"
            className="w-7 h-7 rounded flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & Discounts"
        subtitle="Create, monitor, and manage promotional discount codes"
        countBadge={`${coupons.length} total`}
        primaryAction={{
          label: "Create Coupon",
          icon: Plus,
          onClick: () => setIsCreateModalOpen(true),
        }}
      />

      <DataTable
        tableId="admin_coupons"
        columns={columns}
        data={coupons}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search coupon codes…"
        emptyTitle="No coupons found"
        emptyDescription="Create your first promotional discount coupon to attract shoppers."
        emptyActionLabel="Create Coupon"
        onEmptyAction={() => setIsCreateModalOpen(true)}
      />

      {/* Create Coupon Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Discount Coupon"
        description="Set up promotional codes and configure cart discount conditions"
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] text-[var(--text-sm)] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-coupon-form"
              disabled={isSubmitting}
              className="h-[var(--btn-height-md)] px-5 rounded-[var(--btn-radius)] bg-[var(--color-primary)] text-white text-[var(--text-sm)] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create Coupon"}
            </button>
          </>
        }
      >
        <form
          id="create-coupon-form"
          onSubmit={handleCreateCoupon}
          className="space-y-4 text-[var(--text-sm)]"
        >
          {formError && (
            <div className="p-3 bg-[var(--color-danger-subtle)] border border-[var(--color-danger)] text-[var(--color-danger)] rounded-[var(--radius-sm)] text-xs flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
              Coupon Code <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME10, FESTIVE500"
              className="w-full h-[var(--input-height)] px-3 uppercase font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="w-full h-[var(--input-height)] px-3 rounded-[var(--input-radius)] border border-[var(--input-border)] bg-[var(--color-surface)] text-[var(--text-sm)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Discount Value <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "PERCENTAGE" ? "10" : "500"}
                className="w-full h-[var(--input-height)] px-3 font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Min Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="0"
                className="w-full h-[var(--input-height)] px-3 font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Max Discount Cap (₹)
              </label>
              <input
                type="number"
                min="0"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder={discountType === "PERCENTAGE" ? "1000" : "Optional"}
                className="w-full h-[var(--input-height)] px-3 font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Total Usage Limit
              </label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
                className="w-full h-[var(--input-height)] px-3 font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-xs)] font-semibold text-[var(--color-fg)] mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-[var(--input-height)] px-3 font-mono text-[var(--text-sm)] rounded-[var(--input-radius)] border border-[var(--input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title={`Delete coupon ${deleteTarget.code}?`}
          description="Are you sure you want to delete this coupon? Customers will no longer be able to apply this discount."
          confirmLabel="Delete Coupon"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
