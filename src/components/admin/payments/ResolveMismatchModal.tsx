"use client";

import React, { useState } from "react";
import { Modal } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";

interface ResolveMismatchModalProps {
  item: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResolveMismatchModal({
  item,
  isOpen,
  onClose,
  onSuccess,
}: ResolveMismatchModalProps) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [action, setAction] = useState<"RESOLVE" | "IGNORE">("RESOLVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionNote.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/reconciliation/${item.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionNote,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resolve item");
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
      title="Resolve Reconciliation Mismatch"
      subtitle={`Item: ${item.mismatchType} (Txn: ${item.gatewayTxnId || "N/A"})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="font-semibold text-slate-800">
            Mismatch Category:{" "}
            <span className="text-amber-700">{item.mismatchType.replace(/_/g, " ")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
            <div>
              Platform Amount:{" "}
              <span className="font-mono font-medium text-slate-900">
                {item.platformAmountPaise ? formatPaise(item.platformAmountPaise, true) : "—"}
              </span>
            </div>
            <div>
              Gateway Amount:{" "}
              <span className="font-mono font-medium text-slate-900">
                {item.gatewayAmountPaise ? formatPaise(item.gatewayAmountPaise, true) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">
            Action <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="reconcileAction"
                checked={action === "RESOLVE"}
                onChange={() => setAction("RESOLVE")}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Resolve with documented note</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="reconcileAction"
                checked={action === "IGNORE"}
                onChange={() => setAction("IGNORE")}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-800">Ignore (decision recorded)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">
            Written Resolution Note <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder={
              action === "IGNORE"
                ? "State why this mismatch is being ignored..."
                : "Explain how this mismatch was investigated and resolved..."
            }
            className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Resolution never silently edits or overwrites transactions; it appends an auditable
            resolution record.
          </p>
        </div>

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
            disabled={!resolutionNote.trim() || loading}
            className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 shadow-sm transition-colors"
          >
            {loading ? "Saving..." : action === "IGNORE" ? "Save as Ignored" : "Resolve Mismatch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
