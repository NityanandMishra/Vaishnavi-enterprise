"use client";

import React, { useState, useTransition } from "react";
import {
  XCircle,
  RotateCcw,
  AlertTriangle,
  MessageCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { customerCancelOrder } from "@/app/(store)/actions";
import { ownerWhatsAppUrl } from "@/lib/utils";

interface CustomerOrderActionsProps {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
}

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found better price or alternative",
  "Delivery timeline is too long",
  "Need to modify shipping address or contact info",
  "Incorrect item or quantity selected",
  "Other",
] as const;

export default function CustomerOrderActions({
  orderId,
  orderNumber,
  status,
  paymentMethod,
  totalAmount,
}: CustomerOrderActionsProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelNote, setCancelNote] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCancellable = ["PENDING", "CONFIRMED", "PROCESSING", "CAPTURED", "COD_CONFIRMED"].includes(
    status
  );
  const isReturnEligible = status === "DELIVERED";

  if (!isCancellable && !isReturnEligible && status !== "CANCELLED" && status !== "RETURNED") {
    return null;
  }

  function handleCancelSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await customerCancelOrder(orderId, cancelReason, cancelNote);
      if (res.ok) {
        setShowCancelModal(false);
        setSuccessMessage("Your order has been cancelled successfully.");
      } else {
        setErrorMessage(res.error || "Failed to cancel order.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {status === "CANCELLED" && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <XCircle size={15} className="text-rose-600" /> Order Cancelled
          </p>
          <p className="text-slate-600 leading-relaxed">
            This order has been cancelled. If you completed payment online, the refund has been flagged for gateway processing back to your payment account.
          </p>
        </div>
      )}

      {status === "RETURNED" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <RotateCcw size={15} className="text-amber-700" /> Return Requested
          </p>
          <p className="text-amber-800 leading-relaxed">
            Your return request has been recorded. Our Bhadohi warehouse team is coordinating reverse pickup and quality verification.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2.5">
        {isCancellable && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setShowCancelModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-md border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 hover:text-rose-800 transition-colors cursor-pointer"
          >
            <XCircle size={14} />
            <span>Cancel Order</span>
          </button>
        )}

        {/* Self-service returns are Phase 4 (blocked in v1, spec 05); returns go through the desk. */}
        {isReturnEligible && (
          <a
            href={ownerWhatsAppUrl(`Hi, I need help with a return or replacement for Order #${orderNumber}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors"
          >
            <MessageCircle size={14} />
            <span>Return / Replacement Help on WhatsApp</span>
          </a>
        )}
      </div>

      {/* ── Cancel Order Modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cancel Order #{orderNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to cancel this order?
                </p>
              </div>
            </div>

            <form onSubmit={handleCancelSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="Tell us more about why you are cancelling..."
                  className="w-full p-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {paymentMethod !== "COD" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                  <ShieldAlert size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    Your online payment will be marked for automatic reversal. Gateway refunds typically credit back to your account within 5–7 business days.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Cancelling…</span>
                    </>
                  ) : (
                    <span>Confirm Cancellation</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
