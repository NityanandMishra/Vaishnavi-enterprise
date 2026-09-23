"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/admin/ui";
import { formatPaise, parsePaise } from "@/lib/money";
import {
  RefundableBreakdown,
  RefundReasonCode,
  REFUND_REASON_LABELS,
} from "@/lib/payments/payment-types";
import { AlertTriangle, Info, Check, ShieldAlert } from "lucide-react";

interface RefundInitiationModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RefundInitiationModal({
  orderId,
  isOpen,
  onClose,
  onSuccess,
}: RefundInitiationModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [breakdown, setBreakdown] = useState<RefundableBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [refundType, setRefundType] = useState<"full" | "by_item" | "custom">("full");
  const [customAmountRupees, setCustomAmountRupees] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [includeShipping, setIncludeShipping] = useState<boolean>(true);
  const [reasonCode, setReasonCode] = useState<RefundReasonCode | "">("");
  const [note, setNote] = useState<string>("");
  const [codMethod, setCodMethod] = useState<"bank_transfer" | "upi" | "cash">("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState<string>("");

  useEffect(() => {
    if (!orderId || !isOpen) {
      setBreakdown(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/admin/orders/${orderId}/refundable`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBreakdown(data.data);
          // Initialise all active items selected
          const itemMap: Record<string, boolean> = {};
          data.data.items?.forEach((it: any) => {
            itemMap[it.orderItemId] = true;
          });
          setSelectedItemIds(itemMap);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId, isOpen]);

  if (!isOpen || !orderId) return null;

  // Calculate current refund amount in paise
  let computedAmountPaise = 0;
  let computedTaxPaise = 0;

  if (breakdown) {
    if (refundType === "full") {
      computedAmountPaise = breakdown.refundablePaise;
      computedTaxPaise = breakdown.taxComponentPaise;
    } else if (refundType === "custom") {
      computedAmountPaise = parsePaise(customAmountRupees);
      const ratio = breakdown.paidPaise > 0 ? breakdown.taxComponentPaise / breakdown.refundablePaise : 0;
      computedTaxPaise = Math.round(computedAmountPaise * ratio);
    } else if (refundType === "by_item") {
      let itemsTotalPaise = 0;
      let itemsTaxPaise = 0;

      breakdown.items.forEach((it) => {
        if (selectedItemIds[it.orderItemId]) {
          itemsTotalPaise += it.lineTotalPaise;
          itemsTaxPaise += it.totalTaxPaise;
        }
      });

      if (includeShipping) {
        itemsTotalPaise += breakdown.shippingPaise;
      }

      // Apportion proportional discount across selected items
      const totalAllItemsPaise = breakdown.items.reduce((s, it) => s + it.lineTotalPaise, 0) || 1;
      const proportionSelected = itemsTotalPaise / totalAllItemsPaise;
      const discountApportionedPaise = Math.round(breakdown.discountPaise * proportionSelected);

      computedAmountPaise = Math.max(0, itemsTotalPaise - discountApportionedPaise);
      // Cap at refundable
      computedAmountPaise = Math.min(computedAmountPaise, breakdown.refundablePaise);
      computedTaxPaise = itemsTaxPaise;
    }
  }

  const isExceedsCap = breakdown ? computedAmountPaise > breakdown.refundablePaise : false;
  const isAboveThreshold = breakdown ? computedAmountPaise > breakdown.approvalThresholdPaise : false;

  const isSubmitDisabled =
    !reasonCode ||
    computedAmountPaise <= 0 ||
    isExceedsCap ||
    (reasonCode === "OTHER" && !note.trim()) ||
    (breakdown?.isCod && !referenceNumber.trim()) ||
    submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled || !breakdown) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedLineKeys = Object.entries(selectedItemIds)
        .filter(([_, sel]) => sel)
        .map(([id]) => id);

      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amountPaise: computedAmountPaise,
          reasonCode,
          note,
          lineIds: refundType === "by_item" ? selectedLineKeys : undefined,
          method: breakdown.isCod ? codMethod : "gateway",
          referenceNumber: breakdown.isCod ? referenceNumber : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 202) {
        throw new Error(data.error || "Failed to initiate refund");
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={`Refund Order #${breakdown?.orderNumber || ""}`}
      subtitle="Issue a controlled refund against this order"
    >
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">
          Loading order refundable details...
        </div>
      ) : error && !breakdown ? (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      ) : breakdown ? (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* ── Summary Tiles ── */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <div>
              <div className="text-[11px] text-slate-500">Paid</div>
              <div className="text-sm font-mono font-semibold text-slate-900 mt-0.5">
                {formatPaise(breakdown.paidPaise, true)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Already Refunded</div>
              <div className="text-sm font-mono font-semibold text-slate-600 mt-0.5">
                {formatPaise(breakdown.alreadyRefundedPaise, true)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-700 font-medium">Refundable</div>
              <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                {formatPaise(breakdown.refundablePaise, true)}
              </div>
            </div>
          </div>

          {/* ── Refund Type Selector ── */}
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Refund Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRefundType("full")}
                className={`py-2 px-3 rounded border text-left flex flex-col justify-between transition-colors ${
                  refundType === "full"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>Full Refund</span>
                <span className="font-mono text-[11px] text-slate-500 mt-1">
                  {formatPaise(breakdown.refundablePaise, true)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRefundType("by_item")}
                className={`py-2 px-3 rounded border text-left flex flex-col justify-between transition-colors ${
                  refundType === "by_item"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>By Item</span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Select items
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRefundType("custom")}
                className={`py-2 px-3 rounded border text-left flex flex-col justify-between transition-colors ${
                  refundType === "custom"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>Custom Amount</span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Enter value
                </span>
              </button>
            </div>
          </div>

          {/* ── Custom Amount Input ── */}
          {refundType === "custom" && (
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Enter Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(breakdown.refundablePaise / 100).toFixed(2)}
                  value={customAmountRupees}
                  onChange={(e) => setCustomAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
              {isExceedsCap && (
                <p className="text-red-600 text-[11px] mt-1">
                  Maximum refundable is {formatPaise(breakdown.refundablePaise, true)}
                </p>
              )}
            </div>
          )}

          {/* ── By Item Selection (ACTIVE Lines Only) ── */}
          {refundType === "by_item" && (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
              <div className="font-medium text-slate-800 mb-1">
                Select Active Items for Refund
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {breakdown.items.map((it) => (
                  <label
                    key={it.orderItemId}
                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selectedItemIds[it.orderItemId]}
                        onChange={(e) =>
                          setSelectedItemIds({
                            ...selectedItemIds,
                            [it.orderItemId]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-medium text-slate-900">
                          {it.productName}{" "}
                          {it.variantTitle && (
                            <span className="text-slate-500 font-normal">
                              ({it.variantTitle})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Qty: {it.quantity} · Taxable: {formatPaise(it.taxableValuePaise)} · GST: {formatPaise(it.totalTaxPaise)}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-slate-800">
                      {formatPaise(it.lineTotalPaise, true)}
                    </div>
                  </label>
                ))}

                {breakdown.shippingPaise > 0 && (
                  <label className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeShipping}
                        onChange={(e) => setIncludeShipping(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-slate-900">Shipping Charges</span>
                    </div>
                    <div className="font-mono font-semibold text-slate-800">
                      {formatPaise(breakdown.shippingPaise, true)}
                    </div>
                  </label>
                )}
              </div>

              {computedTaxPaise > 0 && (
                <div className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded flex items-center gap-1.5 border border-indigo-100">
                  <Info size={13} />
                  Includes {formatPaise(computedTaxPaise, true)} GST (reclaimable under stored pricing mode)
                </div>
              )}
            </div>
          )}

          {/* ── Reason Selector ── */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as any)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">Select a reason...</option>
              {Object.entries(REFUND_REASON_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Note (mandatory if reason is OTHER) ── */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Note {reasonCode === "OTHER" && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                reasonCode === "OTHER"
                  ? "Explain why this refund is being issued..."
                  : "Internal notes or customer communication..."
              }
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required={reasonCode === "OTHER"}
            />
          </div>

          {/* ── COD / Manual Method Selector ── */}
          {breakdown.isCod ? (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <Info size={14} />
                COD Manual Refund Destination
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Refund Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={codMethod}
                    onChange={(e) => setCodMethod(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    required
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI Transfer</option>
                    <option value="cash">Cash in Hand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Reference / UTR Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR2608000124"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              Refund to: <span className="font-medium text-slate-700">Original Gateway Payment Method</span>
            </div>
          )}

          {/* ── Warning Banner ── */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              isAboveThreshold
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            {isAboveThreshold ? (
              <ShieldAlert size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              {isAboveThreshold ? (
                <>
                  <div className="font-semibold">Requires Second Approver</div>
                  <div>
                    This refund of {formatPaise(computedAmountPaise, true)} exceeds the{" "}
                    {formatPaise(breakdown.approvalThresholdPaise)} threshold and must be approved by
                    another authorised user before sending.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold">Irreversible Action</div>
                  <div>
                    ⚠️ This sends {formatPaise(computedAmountPaise, true)} to the customer. It cannot
                    be reversed.
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[11px]">
              {error}
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`px-4 py-1.5 rounded text-xs font-semibold text-white shadow-sm transition-colors ${
                isSubmitDisabled
                  ? "bg-slate-300 cursor-not-allowed"
                  : isAboveThreshold
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {submitting
                ? "Processing..."
                : isAboveThreshold
                ? "Request Approval"
                : "Initiate Refund"}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
