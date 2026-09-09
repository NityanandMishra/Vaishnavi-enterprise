"use client";

import React, { useState, useEffect } from "react";
import Modal from "@/components/admin/ui/Modal";
import { toast } from "@/components/admin/ui/Toast";
import { formatINR } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  bulkAdjustPrice,
  undoPriceAdjustment,
  BulkPriceAdjustParams,
} from "@/app/admin/(authenticated)/products/actions";

interface BulkPriceAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds: string[];
  onSuccess?: () => void;
}

export default function BulkPriceAdjustModal({
  isOpen,
  onClose,
  selectedProductIds,
  onSuccess,
}: BulkPriceAdjustModalProps) {
  const [applyTo, setApplyTo] = useState<"SELLING" | "MRP" | "BOTH">("SELLING");
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [mode, setMode] = useState<"PERCENT" | "ABSOLUTE">("PERCENT");
  const [value, setValue] = useState<number>(10);
  const [rounding, setRounding] = useState<"NONE" | "NEAREST_1" | "NEAREST_10" | "END_IN_9">(
    "END_IN_9"
  );
  const [conflictResolution, setConflictResolution] = useState<"SKIP" | "RAISE_MRP">("RAISE_MRP");

  // Server Dry-Run state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalVariants: number;
    conflictCount: number;
    preview: Array<{
      id: string;
      sku: string;
      title: string;
      oldPrice: number;
      newPrice: number;
      oldMrp: number;
      newMrp: number;
      hasConflict: boolean;
    }>;
  } | null>(null);

  const [isApplying, setIsApplying] = useState(false);

  // Fetch server dry-run preview whenever parameters change
  useEffect(() => {
    if (!isOpen || selectedProductIds.length === 0) return;

    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const res = await bulkAdjustPrice({
          productIds: selectedProductIds,
          mode,
          direction,
          value: Number(value) || 0,
          applyTo,
          rounding,
          conflictResolution,
          dryRun: true,
        });

        if (res.success && res.preview) {
          setPreviewData({
            totalVariants: res.totalVariants || 0,
            conflictCount: res.conflictCount || 0,
            preview: res.preview,
          });
        }
      } catch (err) {
        console.error("Dry run preview error:", err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    const debounce = setTimeout(fetchPreview, 300);
    return () => clearTimeout(debounce);
  }, [
    isOpen,
    selectedProductIds,
    mode,
    direction,
    value,
    applyTo,
    rounding,
    conflictResolution,
  ]);

  const handleApply = async () => {
    if (!value || value <= 0) {
      toast.error("Invalid Value", "Please enter a price adjustment amount greater than zero.");
      return;
    }

    setIsApplying(true);
    try {
      const res = await bulkAdjustPrice({
        productIds: selectedProductIds,
        mode,
        direction,
        value: Number(value),
        applyTo,
        rounding,
        conflictResolution,
        dryRun: false,
      });

      if (res.success && res.batchId) {
        const batchId = res.batchId;
        const count = res.affectedCount || previewData?.totalVariants || 0;

        // 30-Second Undo Toast
        toast.success(
          `Adjusted prices on ${count} variants`,
          "Changes committed to database.",
          async () => {
            const undoRes = await undoPriceAdjustment(batchId);
            if (undoRes.success) {
              toast.info("Adjustment Reverted", `Batch ${batchId} has been rolled back.`);
              onSuccess?.();
            } else {
              toast.error("Reversal Failed", undoRes.error || "Could not revert batch.");
            }
          }
        );

        onClose();
        onSuccess?.();
      } else {
        toast.error("Bulk Adjustment Failed", res.error || "Could not apply price adjustment.");
      }
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to adjust prices.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adjust Price · ${selectedProductIds.length} Products`}
      subtitle={`Compute safe percentage or fixed adjustments across ${previewData?.totalVariants ?? "..."} variants.`}
      maxWidth="lg"
    >
      <div className="space-y-5 py-2">
        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[var(--text-xs)]">
          {/* Apply To */}
          <div className="space-y-1.5">
            <span className="font-bold text-[var(--color-fg)] block">Apply To</span>
            <div className="flex gap-2">
              {[
                { id: "SELLING", label: "Selling Price" },
                { id: "MRP", label: "MRP" },
                { id: "BOTH", label: "Both" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApplyTo(opt.id as any)}
                  className={`flex-1 py-1.5 px-2 rounded-md font-medium border text-center transition-colors ${
                    applyTo === opt.id
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <span className="font-bold text-[var(--color-fg)] block">Direction</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("INCREASE")}
                className={`flex-1 py-1.5 px-2 rounded-md font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                  direction === "INCREASE"
                    ? "bg-[var(--color-success)] text-white border-[var(--color-success)] shadow-xs"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <TrendingUp size={14} /> Increase (+)
              </button>
              <button
                type="button"
                onClick={() => setDirection("DECREASE")}
                className={`flex-1 py-1.5 px-2 rounded-md font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                  direction === "DECREASE"
                    ? "bg-[var(--color-danger)] text-white border-[var(--color-danger)] shadow-xs"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <TrendingDown size={14} /> Decrease (-)
              </button>
            </div>
          </div>

          {/* Amount & Mode */}
          <div className="space-y-1.5">
            <span className="font-bold text-[var(--color-fg)] block">Adjustment Amount</span>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
                  className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[var(--text-sm)] text-[var(--color-fg)]"
                />
              </div>
              <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMode("PERCENT")}
                  className={`px-3 py-1 font-bold ${
                    mode === "PERCENT"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setMode("ABSOLUTE")}
                  className={`px-3 py-1 font-bold ${
                    mode === "ABSOLUTE"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  ₹
                </button>
              </div>
            </div>
          </div>

          {/* Rounding Strategy */}
          <div className="space-y-1.5">
            <span className="font-bold text-[var(--color-fg)] block">Psychological Rounding</span>
            <select
              value={rounding}
              onChange={(e) => setRounding(e.target.value as any)}
              className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] font-medium"
            >
              <option value="END_IN_9">End in 9 (e.g. ₹899, ₹1,299)</option>
              <option value="NEAREST_10">Nearest ₹10 (e.g. ₹900, ₹1,300)</option>
              <option value="NEAREST_1">Nearest ₹1 (No decimals)</option>
              <option value="NONE">No Rounding</option>
            </select>
          </div>
        </div>

        {/* Server Dry-Run Preview Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)] flex items-center gap-1.5">
              Live Server Preview (First 10 of {previewData?.totalVariants ?? 0} variants)
              {isLoadingPreview && <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />}
            </span>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden max-h-48 overflow-y-auto bg-[var(--color-surface)]">
            <table className="w-full text-left text-[var(--text-xs)] border-collapse font-mono">
              <thead className="bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)] border-b border-[var(--color-border)] sticky top-0 font-sans font-semibold">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2 text-right">Selling Price</th>
                  <th className="p-2 text-right">MRP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {previewData?.preview.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[var(--color-surface-hover)] ${
                      row.hasConflict ? "bg-amber-500/10 text-[var(--color-warning)]" : ""
                    }`}
                  >
                    <td className="p-2 truncate max-w-[150px] font-medium text-[var(--color-fg)]">
                      {row.sku}
                    </td>
                    <td className="p-2 text-right">
                      <span className="line-through text-[var(--color-fg-muted)] text-[10px] mr-1.5">
                        {formatINR(row.oldPrice)}
                      </span>
                      <span className="font-bold text-[var(--color-fg)]">
                        {formatINR(row.newPrice)}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <span className="line-through text-[var(--color-fg-muted)] text-[10px] mr-1.5">
                        {formatINR(row.oldMrp)}
                      </span>
                      <span className="font-bold text-[var(--color-fg)]">
                        {formatINR(row.newMrp)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MRP Conflict Notice */}
        {previewData && previewData.conflictCount > 0 && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 text-[var(--text-xs)] space-y-2">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>
                {previewData.conflictCount} variant{previewData.conflictCount > 1 ? "s" : ""} would end up with a selling price higher than MRP.
              </span>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--color-fg)]">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictResolution === "RAISE_MRP"}
                  onChange={() => setConflictResolution("RAISE_MRP")}
                />
                Raise their MRP to match selling price (recommended)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--color-fg)]">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictResolution === "SKIP"}
                  onChange={() => setConflictResolution("SKIP")}
                />
                Skip those {previewData.conflictCount} variants
              </label>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--text-sm)] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || isLoadingPreview || !previewData || previewData.totalVariants === 0}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[var(--text-sm)] font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Applying...
              </>
            ) : (
              <>
                <Check size={15} /> Apply to {previewData?.totalVariants || 0} variants
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
