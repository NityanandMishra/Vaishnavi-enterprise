"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, EmptyState, Modal } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Clock,
  UserCheck,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

type SegmentType = "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";

export default function RefundQueuePage() {
  const [activeSegment, setActiveSegment] = useState<SegmentType>("REQUESTED");
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reject modal state
  const [rejectingRefund, setRejectingRefund] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current session user info
  const [currentUserId, setCurrentUserId] = useState<string>("admin");

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/refunds");
      const json = await res.json();
      if (json.data) {
        setRefunds(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Segment counts
  const countRequested = refunds.filter((r) => r.status === "REQUESTED").length;
  const countProcessing = refunds.filter((r) => r.status === "PROCESSING").length;
  const countCompleted = refunds.filter((r) => r.status === "COMPLETED").length;
  const countFailed = refunds.filter((r) => r.status === "FAILED").length;
  const countRejected = refunds.filter((r) => r.status === "REJECTED").length;

  const filteredRefunds = refunds.filter((r) => r.status === activeSegment);

  async function handleApprove(refundId: string, amountPaise: number) {
    const confirmApprove = window.confirm(
      `Approve and process refund of ${formatPaise(amountPaise, true)}?\nThis action sends the money and cannot be undone.`
    );
    if (!confirmApprove) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/refunds/${refundId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve refund");
      }

      fetchRefunds();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingRefund || !rejectReason.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/refunds/${rejectingRefund.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject refund");
      }

      setRejectingRefund(null);
      setRejectReason("");
      fetchRefunds();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRetry(refundId: string) {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/refunds/${refundId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry refund");
      fetchRefunds();
    } catch (err: any) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Refund Queue"
        subtitle="Review, approve, and track customer refunds across orders"
        secondaryAction={{
          label: "Back to payments",
          href: "/admin/payments",
        }}
      />

      {/* ── Segmented Control ── */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-medium overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSegment("REQUESTED")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSegment === "REQUESTED"
              ? "border-amber-600 text-amber-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Awaiting approval</span>
          {countRequested > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {countRequested}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment("PROCESSING")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSegment === "PROCESSING"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Processing</span>
          {countProcessing > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
              {countProcessing}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment("COMPLETED")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSegment === "COMPLETED"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Completed</span>
          <span className="text-slate-400">({countCompleted})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment("FAILED")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSegment === "FAILED"
              ? "border-red-600 text-red-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Failed</span>
          {countFailed > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
              {countFailed}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment("REJECTED")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeSegment === "REJECTED"
              ? "border-slate-800 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Rejected</span>
          <span className="text-slate-400">({countRejected})</span>
        </button>
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading refund queue...
        </div>
      ) : filteredRefunds.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200">
          <EmptyState
            title={`No ${activeSegment.toLowerCase().replace("_", " ")} refunds`}
            description={
              activeSegment === "REQUESTED"
                ? "No high-value refunds are currently awaiting approval."
                : `There are currently no refunds in the ${activeSegment.toLowerCase()} queue.`
            }
          />
        </div>
      ) : activeSegment === "REQUESTED" ? (
        /* ── S4: Approval Cards for Awaiting Approval ── */
        <div className="space-y-4">
          {filteredRefunds.map((refund) => {
            const isSelfRequest = refund.requestedBy === currentUserId;

            return (
              <div
                key={refund.id}
                className="p-5 bg-white rounded-xl border border-amber-200 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-mono font-bold text-slate-900">
                      {formatPaise(refund.amountPaise, true)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Link
                        href={`/admin/orders/${refund.orderId}`}
                        className="font-mono font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        #{refund.order?.orderNumber || refund.orderId}
                        <ExternalLink size={12} />
                      </Link>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700 font-medium">
                        {refund.order?.customerName || "Customer"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status="REQUESTED" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500">Reason</span>
                    <div className="mt-0.5 font-semibold text-slate-800">
                      {refund.reasonCode}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Requested By</span>
                    <div className="mt-0.5 font-medium text-slate-800">
                      {refund.requestedByName || "Staff"} ·{" "}
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(refund.requestedAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Refund Method</span>
                    <div className="mt-0.5 font-medium text-slate-800 capitalize">
                      {refund.method}
                      {refund.referenceNumber && (
                        <span className="font-mono text-[11px] text-slate-500 block">
                          Ref: {refund.referenceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Reclaimable Tax</span>
                    <div className="mt-0.5 font-mono font-medium text-slate-800">
                      {formatPaise(refund.taxComponentPaise, true)}
                    </div>
                  </div>
                </div>

                {refund.note && (
                  <div className="p-3 bg-amber-50/60 rounded border border-amber-100 text-xs text-amber-900">
                    <span className="font-semibold">Requester Note: </span>"{refund.note}"
                  </div>
                )}

                {isSelfRequest && (
                  <div className="p-2.5 bg-slate-100 rounded text-xs text-slate-600 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-slate-500 flex-shrink-0" />
                    <span>
                      You cannot approve a refund you requested (Two-person verification rule SEC-04).
                    </span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <Link
                    href={`/admin/orders/${refund.orderId}`}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1"
                  >
                    View order details
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSelfRequest || isSubmitting}
                      onClick={() => setRejectingRefund(refund)}
                      className="px-3 py-1.5 rounded text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={isSelfRequest || isSubmitting}
                      onClick={() => handleApprove(refund.id, refund.amountPaise)}
                      className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors"
                    >
                      Approve & Send ({formatPaise(refund.amountPaise, true)})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Standard Table for Other Segments ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Refund No</th>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Approved By</th>
                  {activeSegment === "FAILED" && (
                    <th className="py-3 px-4 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {r.refundNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${r.orderId}`}
                        className="font-mono text-indigo-600 hover:underline"
                      >
                        #{r.order?.orderNumber || r.orderId}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatPaise(r.amountPaise, true)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div>{r.reasonCode}</div>
                      {r.failureReason && (
                        <div className="text-[10px] text-red-600 mt-0.5">
                          {r.failureReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {r.requestedByName || "Staff"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {r.approvedByName || "—"}
                    </td>
                    {activeSegment === "FAILED" && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleRetry(r.id)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          <RotateCcw size={12} />
                          Retry refund
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reject Reason Modal ── */}
      {rejectingRefund && (
        <Modal
          isOpen={!!rejectingRefund}
          onClose={() => {
            setRejectingRefund(null);
            setRejectReason("");
          }}
          maxWidth="md"
          title={`Reject Refund ${rejectingRefund.refundNumber}`}
          subtitle={`Amount: ${formatPaise(rejectingRefund.amountPaise, true)}`}
        >
          <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              State why this refund request is being declined. The requester will be notified
              and no money will leave the business.
            </p>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Need the damage photos from transit first..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectingRefund(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!rejectReason.trim() || isSubmitting}
                className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 shadow-sm transition-colors"
              >
                {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
