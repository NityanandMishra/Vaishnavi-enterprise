"use client";

import React, { useState } from "react";
import { Modal } from "@/components/admin/ui";
import { formatPaise, parsePaise } from "@/lib/money";
import { AlertCircle } from "lucide-react";

interface RecordRemittanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierName: string;
  expectedPaise: number;
  orderCount?: number;
  orderIds?: string[];
  onSuccess?: () => void;
}

export default function RecordRemittanceModal({
  isOpen,
  onClose,
  courierName,
  expectedPaise,
  orderCount = 0,
  orderIds = [],
  onSuccess,
}: RecordRemittanceModalProps) {
  const [receivedRupees, setReceivedRupees] = useState<string>(
    (expectedPaise / 100).toFixed(2)
  );
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const receivedPaise = parsePaise(receivedRupees);
  const variancePaise = expectedPaise - receivedPaise;
  const hasVariance = variancePaise !== 0;

  const isSaveDisabled =
    receivedPaise <= 0 ||
    !bankReference.trim() ||
    (hasVariance && !note.trim()) ||
    loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaveDisabled) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cod/remittances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courierId: courierName,
          expectedPaise,
          receivedPaise,
          bankReference,
          note: note.trim() || undefined,
          orderIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record remittance");
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={`Record Remittance — ${courierName}`}
      subtitle={`Reconcile courier cash against bank credit for ${orderCount} order${orderCount === 1 ? "" : "s"}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <div className="text-slate-500">Expected Total</div>
            <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
              {formatPaise(expectedPaise, true)}
            </div>
            <div className="text-[10px] text-slate-500">{orderCount} orders</div>
          </div>
          <div>
            <div className="text-slate-500">Computed Variance</div>
            <div
              className={`font-mono text-sm font-bold mt-0.5 ${
                hasVariance ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {hasVariance ? (variancePaise > 0 ? "-" : "+") : ""}
              {formatPaise(Math.abs(variancePaise), true)}
            </div>
            <div className="text-[10px] text-slate-500">
              {hasVariance ? "⚠️ Discrepancy" : "✓ Matching"}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">
            Amount Received in Bank (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-400 font-mono">₹</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={receivedRupees}
              onChange={(e) => setReceivedRupees(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">
            Bank Reference / UTR Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value)}
            placeholder="e.g. UTR2608119283"
            className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        {hasVariance && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
            <div className="text-red-800 font-semibold flex items-center gap-1.5">
              <AlertCircle size={14} className="text-red-600" />
              Variance Note Required
            </div>
            <p className="text-[11px] text-red-700">
              Expected and received amounts differ by {formatPaise(Math.abs(variancePaise), true)}.
              An explanatory note is mandatory before saving, and affected orders will move to the Discrepancies queue.
            </p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 1 order short — investigating with courier..."
              className="w-full px-2 py-1.5 border border-red-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
              required
            />
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[11px]">
            {error}
          </div>
        )}

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
            disabled={isSaveDisabled}
            className={`px-4 py-1.5 rounded text-xs font-semibold text-white shadow-sm transition-colors ${
              isSaveDisabled
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Recording..." : "Save Remittance"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
