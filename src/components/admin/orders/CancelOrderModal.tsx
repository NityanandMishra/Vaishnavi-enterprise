"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { CANCELLATION_REASONS } from "@/lib/orders/order-types";

interface CancelOrderModalProps {
  order: {
    id: string;
    orderNumber?: string | null;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    paidAmount?: number;
    totalAmount: number;
    items?: { quantity: number; cancelledQty?: number }[];
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelOrderModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeUnits = (order.items || []).reduce(
    (sum, item) => sum + (item.quantity - (item.cancelledQty || 0)),
    0
  );

  const paid = order.paidAmount || 0;
  const isPaid = paid > 0;
  const isCod = order.paymentMethod === "COD";

  const isConfirmDisabled =
    !reason || (reason === "Other" && (!note || note.trim().length === 0)) || loading;

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          note: note.trim() || undefined,
          notifyCustomer,
          actor: "Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to cancel order");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Cancel order {order.orderNumber || `#${order.id.slice(0, 8)}`}?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Current status: <span className="font-semibold text-slate-700">{order.status}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Consequences Block */}
        <div className="mt-4 rounded-lg bg-amber-50/70 border border-amber-200/80 p-4 text-xs space-y-1.5 text-amber-950">
          <div className="font-semibold text-amber-900 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} className="text-amber-700" />
            <span>This will:</span>
          </div>
          {activeUnits > 0 && (
            <p className="pl-5">• Release {activeUnits} reserved {activeUnits === 1 ? "unit" : "units"} back to stock</p>
          )}
          <p className="pl-5">• Mark the order cancelled and set termination timestamp</p>
          {isPaid ? (
            <p className="pl-5 font-semibold text-rose-900">
              • Require a refund of {formatINR(paid)} (paid via {order.paymentMethod})
            </p>
          ) : isCod ? (
            <p className="pl-5 text-slate-600">• No refund needed — payment was not collected (COD)</p>
          ) : null}
        </div>

        {/* Form Fields */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
            >
              <option value="">Select a reason</option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Note {reason === "Other" ? <span className="text-rose-500">* (required when reason is Other)</span> : <span className="text-slate-400">(optional)</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={reason === "Other" ? "Explain why this order is being cancelled..." : "Internal context or notes..."}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="notifyCustomerCheckbox"
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
              className="h-4 w-4 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="notifyCustomerCheckbox" className="text-xs text-slate-700 cursor-pointer select-none">
              Notify the customer by email
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Keep order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>Cancel this order</span>
          </button>
        </div>
      </div>
    </div>
  );
}
