"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Equal,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { Drawer, useToast } from "@/components/admin/ui";
import { ReasonCode, ManualReasonCodes } from "@/lib/inventory/types";
import { performStockAdjustment } from "@/app/admin/(authenticated)/inventory/actions";

export interface AdjustStockDrawerItem {
  id: string; // inventory or variant id
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  onHand: number;
  reserved: number;
  available: number;
  reservedOrdersCount?: number;
}

interface AdjustStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: AdjustStockDrawerItem | null;
  defaultMode?: "DELTA" | "ABSOLUTE";
  defaultDirection?: "ADD" | "REMOVE";
  onSuccess?: () => void;
}

export default function AdjustStockDrawer({
  isOpen,
  onClose,
  item,
  defaultMode = "DELTA",
  defaultDirection = "ADD",
  onSuccess,
}: AdjustStockDrawerProps) {
  const [direction, setDirection] = useState<"ADD" | "REMOVE" | "SET">(
    defaultDirection === "REMOVE" ? "REMOVE" : "ADD"
  );
  const [quantity, setQuantity] = useState<number>(10);
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Large confirmation modal state (FR-12)
  const [confirmLargeModalOpen, setConfirmLargeModalOpen] = useState(false);
  const [largeAdjustPayload, setLargeAdjustPayload] = useState<any>(null);

  const toast = useToast();

  useEffect(() => {
    if (isOpen && item) {
      setDirection(defaultDirection === "REMOVE" ? "REMOVE" : "ADD");
      setQuantity(10);
      setReasonCode("");
      setNote("");
      setConfirmLargeModalOpen(false);
      setLargeAdjustPayload(null);
    }
  }, [isOpen, item, defaultDirection]);

  const onHand = item?.onHand ?? 0;
  const reserved = item?.reserved ?? 0;
  const available = onHand - reserved;

  // Compute live outcome
  const { delta, newOnHand, newAvailable, computedExplanation } = useMemo(() => {
    let d = 0;
    const qty = Math.max(0, quantity || 0);

    if (direction === "ADD") {
      d = qty;
    } else if (direction === "REMOVE") {
      d = -qty;
    } else {
      // SET mode
      d = qty - onHand;
    }

    const nextOnHand = onHand + d;
    const nextAvailable = nextOnHand - reserved;

    let explanation = "";
    if (direction === "SET") {
      if (d > 0) explanation = `This will add ${d} units`;
      else if (d < 0) explanation = `This will remove ${Math.abs(d)} units`;
      else explanation = "No change in stock level";
    }

    return {
      delta: d,
      newOnHand: nextOnHand,
      newAvailable: nextAvailable,
      computedExplanation: explanation,
    };
  }, [direction, quantity, onHand, reserved]);

  const isNegative = newOnHand < 0;
  const leavesOrdersShort =
    delta < 0 && newOnHand < reserved && reserved > 0;

  const isSensitiveReason = (
    [ReasonCode.DAMAGE, ReasonCode.THEFT, ReasonCode.CORRECTION] as string[]
  ).includes(reasonCode);
  const isNoteValid = !isSensitiveReason || note.trim().length >= 10;

  // Validation: reason is mandatory
  const isFormValid =
    reasonCode !== "" &&
    quantity > 0 &&
    !isNegative &&
    isNoteValid;

  async function handleSubmit(e: React.FormEvent, forceConfirmLarge = false) {
    e.preventDefault();
    if (!item) return;

    if (!reasonCode) {
      toast.error("Please select a reason for this adjustment.");
      return;
    }

    if (isSensitiveReason && note.trim().length < 10) {
      toast.error("Add a short explanation (at least 10 characters).");
      return;
    }

    if (isNegative) {
      toast.error(`Cannot remove ${Math.abs(delta)} units — only ${onHand} on hand.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const mode = direction === "SET" ? "ABSOLUTE" : "DELTA";
      const submitQty = direction === "SET" ? quantity : delta;

      const res = await performStockAdjustment({
        variantId: item.variantId,
        mode,
        quantity: submitQty,
        reasonCode: reasonCode as ReasonCode,
        note: note.trim() || undefined,
        confirmLarge: forceConfirmLarge,
      });

      if (res.ok) {
        toast.success(
          "Adjustment Recorded",
          `${delta >= 0 ? "Added" : "Removed"} ${Math.abs(delta)} units on ${
            item.variantTitle || item.productTitle
          }.`
        );
        setConfirmLargeModalOpen(false);
        onClose();
        if (onSuccess) onSuccess();
      } else if (res.status === 428) {
        // Large adjustment requires confirmation (FR-12)
        setLargeAdjustPayload(res.details);
        setConfirmLargeModalOpen(true);
      } else {
        toast.error(res.error || "Failed to save adjustment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save adjustment");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!item) return null;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Adjust Stock"
        subtitle={`${item.productTitle} ${
          item.variantTitle ? `· ${item.variantTitle}` : ""
        } ${item.sku ? `(${item.sku})` : ""}`}
        width="normal"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isFormValid || isSubmitting}
              onClick={(e) => handleSubmit(e, false)}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {isSubmitting ? "Saving Entry…" : "Save Adjustment"}
            </button>
          </div>
        }
      >
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
          {/* 1. CURRENT POSITION CARD */}
          <div className="p-3.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Current Position
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-fg-muted)] block">On hand</span>
                <span className="text-base font-mono font-bold text-[var(--color-fg)]">
                  {onHand}
                </span>
              </div>
              <div className="bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-fg-muted)] block">Reserved</span>
                <span className="text-base font-mono font-bold text-amber-600">
                  {reserved}
                </span>
                {reserved > 0 && (
                  <span className="text-[10px] text-[var(--color-fg-muted)] block">
                    ({item.reservedOrdersCount || 1} orders)
                  </span>
                )}
              </div>
              <div className="bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-fg-muted)] block">Available</span>
                <span className="text-base font-mono font-extrabold text-[var(--color-primary)]">
                  {available}
                </span>
              </div>
            </div>
          </div>

          {/* 2. ADJUSTMENT TYPE SEGMENTED TABS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-fg)]">
              Adjustment Type
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-surface-sunken)] rounded-xl border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setDirection("ADD")}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  direction === "ADD"
                    ? "bg-[var(--color-surface)] text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-300 dark:border-emerald-800"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                <Plus size={14} />
                <span>+ Add</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection("REMOVE")}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  direction === "REMOVE"
                    ? "bg-[var(--color-surface)] text-rose-700 dark:text-rose-400 shadow-xs border border-rose-300 dark:border-rose-800"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                <Minus size={14} />
                <span>− Remove</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection("SET")}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  direction === "SET"
                    ? "bg-[var(--color-surface)] text-blue-700 dark:text-blue-400 shadow-xs border border-blue-300 dark:border-blue-800"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                <Equal size={14} />
                <span>= Set to</span>
              </button>
            </div>
          </div>

          {/* 3. QUANTITY INPUT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-fg)]">
                Quantity *
              </label>
              {computedExplanation && (
                <span className="text-[11px] font-mono text-[var(--color-primary)] font-semibold">
                  {computedExplanation}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none pr-12"
              />
              <span className="absolute right-3 text-xs font-medium text-[var(--color-fg-muted)]">
                pcs
              </span>
            </div>
          </div>

          {/* 4. REASON CODE (MANDATORY, EXCLUDES SALE) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-fg)]">
              Reason *
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
            >
              <option value="" disabled>
                Select a reason…
              </option>
              {ManualReasonCodes.map((code) => (
                <option key={code} value={code}>
                  {code.charAt(0) + code.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              SALE is system-only (recorded via fulfilment, never manual adjustment).
            </p>
          </div>

          {/* 5. NOTE INPUT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-fg)]">
                Note {isSensitiveReason ? <span className="text-rose-500">*</span> : "(optional)"}
              </label>
              {isSensitiveReason && (
                <span
                  className={`text-[10px] font-mono ${
                    note.trim().length >= 10 ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {note.trim().length} / 10 min chars
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isSensitiveReason
                  ? "Required for Damage, Theft, or Correction (at least 10 chars)…"
                  : "Add reference e.g. PO invoice number or supplier note…"
              }
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none ${
                isSensitiveReason && note.trim().length < 10
                  ? "border-rose-300 focus:border-rose-500"
                  : "border-[var(--color-border)]"
              }`}
            />
          </div>

          {/* 6. WARNING / ERROR ALERTS */}
          {isNegative && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                Cannot remove {Math.abs(delta)} units — only {onHand} on hand. Stock cannot go negative.
              </p>
            </div>
          )}

          {leavesOrdersShort && !isNegative && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold">Reserved Stock Impact Warning</p>
                <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                  {reserved} units are reserved for open orders. Removing {Math.abs(delta)} units leaves {newOnHand} on hand, and some pending orders cannot be fulfilled.
                </p>
              </div>
            </div>
          )}

          {/* 7. LIVE RESULT PREVIEW PANEL */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Result Preview
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex items-center justify-between border-r border-slate-800 pr-3">
                <span className="text-slate-400">On hand:</span>
                <span className="font-bold flex items-center gap-1.5">
                  <span>{onHand}</span>
                  <ArrowRight size={11} className="text-slate-500" />
                  <span className={newOnHand < onHand ? "text-rose-400" : "text-emerald-400"}>
                    {newOnHand}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available:</span>
                <span className="font-bold flex items-center gap-1.5">
                  <span>{available}</span>
                  <ArrowRight size={11} className="text-slate-500" />
                  <span className={newAvailable < available ? "text-rose-400" : "text-emerald-400"}>
                    {newAvailable}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </form>
      </Drawer>

      {/* LARGE ADJUSTMENT CONFIRMATION MODAL (FR-12) */}
      {confirmLargeModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-fg)]">
                  Confirm Large Stock Adjustment
                </h3>
                <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                  You are making a significant adjustment that exceeds ±100 units or ±25% of current on-hand.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-sunken)] rounded-xl border border-[var(--color-border)] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Variant:</span>
                <span className="font-semibold text-[var(--color-fg)]">
                  {item.variantTitle || item.productTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Current On Hand:</span>
                <span className="font-mono font-bold">{onHand} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">New Level:</span>
                <span className="font-mono font-bold text-[var(--color-primary)]">
                  {newOnHand} units ({delta >= 0 ? `+${delta}` : delta})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Reason:</span>
                <span className="font-semibold uppercase">{reasonCode}</span>
              </div>
            </div>

            <p className="text-xs text-amber-700 dark:text-amber-300">
              Please double check this count. A common error is entering target stock in Add mode instead of Set mode.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setConfirmLargeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
              >
                {isSubmitting ? "Saving…" : `Yes, ${delta >= 0 ? `Add ${delta}` : `Remove ${Math.abs(delta)}`} Units`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
