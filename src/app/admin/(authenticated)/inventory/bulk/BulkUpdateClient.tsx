"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Plus,
  Minus,
  Equal,
  Trash2,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  ScanLine,
} from "lucide-react";
import { PageHeader, useToast } from "@/components/admin/ui";
import { ReasonCode, ManualReasonCodes } from "@/lib/inventory/types";
import {
  performBulkAdjustment,
  performUndoBulkAdjustment,
} from "@/app/admin/(authenticated)/inventory/actions";

interface AvailableVariant {
  id: string;
  sku: string;
  productTitle: string;
  variantTitle: string | null;
  currentOnHand: number;
  currentReserved: number;
}

interface RowItem {
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string | null;
  currentOnHand: number;
  currentReserved: number;
  quantity: number;
}

interface BulkUpdateClientProps {
  availableVariants: AvailableVariant[];
}

export default function BulkUpdateClient({
  availableVariants,
}: BulkUpdateClientProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<"MANUAL" | "CSV">("MANUAL");

  // Shared Settings
  const [direction, setDirection] = useState<"ADD" | "REMOVE" | "SET">("ADD");
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">(ReasonCode.PURCHASE);
  const [note, setNote] = useState("");

  // Step 1: Rows
  const [rows, setRows] = useState<RowItem[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Server Dry Run Preview
  const [previewData, setPreviewData] = useState<any>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // 60-second Undo State
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);
  const [isUndoing, setIsUndoing] = useState(false);

  const toast = useToast();

  function handleAddSku(skuToAdd: string) {
    const trimmed = skuToAdd.trim().toUpperCase();
    if (!trimmed) return;

    const matched = availableVariants.find(
      (v) => v.sku.toUpperCase() === trimmed
    );
    if (!matched) {
      toast.error(`SKU "${skuToAdd}" not found in catalog.`);
      return;
    }

    if (rows.some((r) => r.variantId === matched.id)) {
      toast.error(`SKU "${matched.sku}" is already in the batch.`);
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        variantId: matched.id,
        sku: matched.sku,
        productTitle: matched.productTitle,
        variantTitle: matched.variantTitle,
        currentOnHand: matched.currentOnHand,
        currentReserved: matched.currentReserved,
        quantity: 10,
      },
    ]);
    setSkuSearch("");
    if (skuInputRef.current) skuInputRef.current.focus();
  }

  function handleRemoveRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleQuantityChange(index: number, val: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, quantity: Math.max(0, val) } : r))
    );
  }

  // Parse CSV
  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const newRows: RowItem[] = [];

      for (let i = 0; i < lines.length; i++) {
        // Assume SKU, Qty format (skip header if first row is not a number)
        const parts = lines[i].split(",").map((p) => p.replace(/"/g, "").trim());
        if (parts.length < 2) continue;
        const [sku, qtyStr] = parts;
        const parsedQty = parseInt(qtyStr, 10);
        if (isNaN(parsedQty)) continue; // Header row

        const matched = availableVariants.find(
          (v) => v.sku.toUpperCase() === sku.toUpperCase()
        );
        if (matched && !newRows.some((r) => r.variantId === matched.id)) {
          newRows.push({
            variantId: matched.id,
            sku: matched.sku,
            productTitle: matched.productTitle,
            variantTitle: matched.variantTitle,
            currentOnHand: matched.currentOnHand,
            currentReserved: matched.currentReserved,
            quantity: parsedQty,
          });
        }
      }

      if (newRows.length > 0) {
        setRows(newRows);
        toast.success("CSV Loaded", `Added ${newRows.length} SKUs from spreadsheet.`);
      } else {
        toast.error("No valid SKU matches found in CSV.");
      }
    };
    reader.readAsText(file);
  }

  // Step 1 -> Step 2: Request Dry Run Preview
  async function handleProceedToPreview() {
    if (rows.length === 0) {
      toast.error("Add at least one SKU to the batch.");
      return;
    }
    if (!reasonCode) {
      toast.error("Select a reason for this batch.");
      return;
    }

    setIsDryRunning(true);
    try {
      const mode = direction === "SET" ? "ABSOLUTE" : "DELTA";
      const adjustments = rows.map((r) => {
        let q = r.quantity;
        if (direction === "REMOVE") q = -r.quantity;
        return { variantId: r.variantId, quantity: q };
      });

      const res = await performBulkAdjustment({
        adjustments,
        mode,
        reasonCode: reasonCode as ReasonCode,
        note: note.trim() || undefined,
        dryRun: true,
      });

      if (res.ok && res.data) {
        setPreviewData(res.data);
        setStep(2);
      } else {
        toast.error(res.error || "Failed to generate preview");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate preview");
    } finally {
      setIsDryRunning(false);
    }
  }

  // Step 2: Commit Batch
  async function handleCommitBatch() {
    if (!previewData) return;

    setIsCommitting(true);
    try {
      const mode = direction === "SET" ? "ABSOLUTE" : "DELTA";
      const adjustments = rows.map((r) => {
        let q = r.quantity;
        if (direction === "REMOVE") q = -r.quantity;
        return { variantId: r.variantId, quantity: q };
      });

      const res = await performBulkAdjustment({
        adjustments,
        mode,
        reasonCode: reasonCode as ReasonCode,
        note: note.trim() || undefined,
        dryRun: false,
      });

      if (res.ok && res.data) {
        const data = res.data as any;
        toast.success(
          "Batch Committed",
          `Adjusted ${data.appliedCount} SKUs (${data.totalDelta >= 0 ? "+" : ""}${data.totalDelta} units).`
        );
        setLastBatchId(data.batchId);
        startUndoTimer(data.batchId);
        setStep(1);
        setRows([]);
        setPreviewData(null);
      } else {
        toast.error(res.error || "Failed to apply batch");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to apply batch");
    } finally {
      setIsCommitting(false);
    }
  }

  // 60-Second Undo Timer
  function startUndoTimer(batchId: string) {
    setUndoSecondsLeft(60);
    const interval = setInterval(() => {
      setUndoSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLastBatchId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleUndo() {
    if (!lastBatchId) return;
    setIsUndoing(true);
    try {
      const res = await performUndoBulkAdjustment(lastBatchId);
      if (res.ok) {
        toast.success(
          "Batch Undone",
          "Compensating ledger entries posted. Stock restored to pre-batch levels."
        );
        setLastBatchId(null);
        setUndoSecondsLeft(0);
      } else {
        toast.error(res.error || "Undo failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Undo failed");
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Bulk Stock Update"
        subtitle="Batch update stock positions with mandatory audit reasons and dry-run preview"
      />

      {/* 60-SECOND UNDO TOAST STRIP */}
      {lastBatchId && undoSecondsLeft > 0 && (
        <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <div>
              <p className="text-xs font-bold">
                Batch applied successfully. (Undo expires in {undoSecondsLeft}s)
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Batch: {lastBatchId}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isUndoing}
            onClick={handleUndo}
            className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>{isUndoing ? "Reverting…" : "Undo Batch"}</span>
          </button>
        </div>
      )}

      {/* STEP PROGRESS INDICATOR */}
      <div className="flex items-center gap-4 text-xs font-semibold border-b border-[var(--color-border)] pb-3">
        <span
          className={`flex items-center gap-1.5 ${
            step === 1 ? "text-[var(--color-primary)] font-bold" : "text-[var(--color-fg-muted)]"
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center font-mono">
            1
          </span>
          <span>Build the Batch</span>
        </span>
        <ArrowRight size={14} className="text-[var(--color-fg-muted)]" />
        <span
          className={`flex items-center gap-1.5 ${
            step === 2 ? "text-[var(--color-primary)] font-bold" : "text-[var(--color-fg-muted)]"
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center font-mono">
            2
          </span>
          <span>Preview & Confirm</span>
        </span>
      </div>

      {step === 1 ? (
        /* ── STEP 1: BUILD THE BATCH ─────────────────────────────────────── */
        <div className="space-y-5">
          {/* Method Selection */}
          <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center gap-4">
            <span className="text-xs font-bold text-[var(--color-fg)]">Method:</span>
            <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] cursor-pointer">
              <input
                type="radio"
                name="method"
                checked={method === "MANUAL"}
                onChange={() => setMethod("MANUAL")}
              />
              <span>Search and add rows</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] cursor-pointer">
              <input
                type="radio"
                name="method"
                checked={method === "CSV"}
                onChange={() => setMethod("CSV")}
              />
              <span>Upload CSV</span>
            </label>
          </div>

          {/* Shared Settings */}
          <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Shared Settings (Applied to whole batch)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Direction */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-fg)] block mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-surface-sunken)] rounded-lg border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setDirection("ADD")}
                    className={`py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${
                      direction === "ADD"
                        ? "bg-[var(--color-surface)] text-emerald-700 shadow-xs"
                        : "text-[var(--color-fg-muted)]"
                    }`}
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("REMOVE")}
                    className={`py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${
                      direction === "REMOVE"
                        ? "bg-[var(--color-surface)] text-rose-700 shadow-xs"
                        : "text-[var(--color-fg-muted)]"
                    }`}
                  >
                    <Minus size={12} />
                    <span>Remove</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("SET")}
                    className={`py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${
                      direction === "SET"
                        ? "bg-[var(--color-surface)] text-blue-700 shadow-xs"
                        : "text-[var(--color-fg-muted)]"
                    }`}
                  >
                    <Equal size={12} />
                    <span>Set to</span>
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-fg)] block mb-1">
                  Reason *
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <option value="" disabled>
                    Select reason…
                  </option>
                  {ManualReasonCodes.map((code) => (
                    <option key={code} value={code}>
                      {code.charAt(0) + code.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-fg)] block mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Stock received — PO 4412"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              </div>
            </div>
          </div>

          {/* Barcode Scanner / SKU Search Input or CSV Drop */}
          {method === "MANUAL" ? (
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--color-fg)] flex items-center gap-1.5">
                  <ScanLine size={14} className="text-[var(--color-primary)]" />
                  <span>Scan or Type SKU (Enter to add)</span>
                </label>
                <span className="text-[11px] text-[var(--color-fg-muted)]">
                  {rows.length} SKU{rows.length === 1 ? "" : "s"} added
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={skuInputRef}
                  type="text"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSku(skuSearch);
                    }
                  }}
                  placeholder="Paste or scan SKU e.g. VE-APP-KUR-RED-M and hit Enter…"
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddSku(skuSearch)}
                  className="px-4 py-2.5 text-xs font-bold rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 cursor-pointer"
                >
                  + Add SKU
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-border)] rounded-2xl text-center space-y-2">
              <FileSpreadsheet size={32} className="mx-auto text-[var(--color-fg-muted)]" />
              <h4 className="text-xs font-bold text-[var(--color-fg)]">
                Upload Spreadsheet (.csv)
              </h4>
              <p className="text-[11px] text-[var(--color-fg-muted)]">
                Format: Column A = SKU, Column B = Quantity
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="text-xs text-[var(--color-fg-muted)] mx-auto file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-[var(--color-border)] file:bg-[var(--color-surface)] file:text-xs file:font-semibold"
              />
            </div>
          )}

          {/* Rows Table */}
          {rows.length > 0 && (
            <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] overflow-hidden shadow-xs">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] font-bold text-[var(--color-fg-muted)]">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Current On Hand</th>
                      <th className="p-3 text-right">
                        Quantity ({direction === "SET" ? "Target" : direction})
                      </th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {rows.map((row, idx) => (
                      <tr key={row.variantId} className="hover:bg-[var(--color-surface-sunken)]">
                        <td className="p-3 font-mono font-bold text-[var(--color-fg)]">
                          {row.sku}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-[var(--color-fg)] truncate max-w-xs">
                            {row.productTitle}
                          </p>
                          <p className="text-[11px] text-[var(--color-fg-muted)]">
                            {row.variantTitle || "Default"}
                          </p>
                        </td>
                        <td className="p-3 text-right font-mono text-[var(--color-fg-muted)]">
                          {row.currentOnHand}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity}
                            onChange={(e) =>
                              handleQuantityChange(idx, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-20 px-2 py-1 text-right font-mono font-bold rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-[var(--color-fg-muted)] hover:text-rose-600 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-[var(--color-surface-sunken)] border-t border-[var(--color-border)] flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {rows.length} rows ready for dry run preview
                </span>
                <button
                  type="button"
                  disabled={isDryRunning}
                  onClick={handleProceedToPreview}
                  className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary)]/90 cursor-pointer shadow-sm"
                >
                  {isDryRunning ? "Computing Preview…" : "Preview & Confirm →"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── STEP 2: PREVIEW & CONFIRM ───────────────────────────────────── */
        <div className="space-y-5">
          {/* Summary Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">
                {previewData?.totalCount} SKUs · {previewData?.totalDelta >= 0 ? `+${previewData?.totalDelta}` : previewData?.totalDelta} units total
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Reason: {reasonCode} · Mode: {direction}
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-emerald-400">
              Dry Run Verified
            </span>
          </div>

          {/* Negative Warning */}
          {previewData?.hasNegative && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3">
              <ShieldAlert size={18} className="text-rose-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-rose-900 dark:text-rose-200">
                <p className="font-bold">Cannot Commit: Negative Stock Detected</p>
                <p className="text-[11px] mt-0.5 text-rose-800 dark:text-rose-300">
                  One or more SKUs would have negative on-hand units after this adjustment. Remove or reduce those rows to proceed.
                </p>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] overflow-hidden shadow-xs">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] font-bold text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">On Hand</th>
                    <th className="p-3 text-right">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {previewData?.rows?.map((row: any) => (
                    <tr
                      key={row.variantId}
                      className={row.isNegative ? "bg-rose-50 dark:bg-rose-950/30" : ""}
                    >
                      <td className="p-3 font-mono font-bold text-[var(--color-fg)]">
                        {row.sku}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-[var(--color-fg)]">{row.productTitle}</p>
                        <p className="text-[11px] text-[var(--color-fg-muted)]">{row.variantTitle}</p>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span>{row.currentOnHand}</span>
                        <span className="text-[var(--color-fg-muted)] mx-1">→</span>
                        <span
                          className={`font-bold ${
                            row.isNegative
                              ? "text-rose-600"
                              : row.newOnHand > row.currentOnHand
                              ? "text-emerald-600"
                              : "text-[var(--color-fg)]"
                          }`}
                        >
                          {row.newOnHand}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span>{row.currentAvailable}</span>
                        <span className="text-[var(--color-fg-muted)] mx-1">→</span>
                        <span className="font-bold text-[var(--color-primary)]">
                          {row.newAvailable}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[var(--color-surface-sunken)] border-t border-[var(--color-border)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-surface)]"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={previewData?.hasNegative || isCommitting}
                onClick={handleCommitBatch}
                className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary)]/90 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isCommitting ? "Applying Batch…" : `Apply to ${previewData?.totalCount} SKUs`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
