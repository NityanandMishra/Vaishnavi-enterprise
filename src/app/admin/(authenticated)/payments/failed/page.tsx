"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";
import {
  AlertTriangle,
  Copy,
  Check,
  Phone,
  XCircle,
  ExternalLink,
  Clock,
  RefreshCw,
} from "lucide-react";

export default function FailedPaymentsQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const fetchFailedQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/payments/failed");
      const json = await res.json();
      if (json.data) setQueue(json.data);
    } catch (err) {
      console.error("Failed to fetch failed payments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFailedQueue();
  }, [fetchFailedQueue]);

  async function handleCopyPaymentLink(orderId: string) {
    try {
      setCopyingId(orderId);
      const res = await fetch("/api/admin/payments/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate link");

      const linkUrl = json.data?.url || `https://rzp.io/i/plink_${orderId}`;
      await navigator.clipboard.writeText(linkUrl);

      setCopiedLinkMap((prev) => ({ ...prev, [orderId]: true }));
      setTimeout(() => {
        setCopiedLinkMap((prev) => ({ ...prev, [orderId]: false }));
      }, 3000);
    } catch (err: any) {
      alert(`Could not generate payment link: ${err.message}`);
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Failed Payments Queue"
        subtitle="Recover failed transactions before stock reservation windows elapse"
        secondaryAction={{
          label: "Back to payments",
          href: "/admin/payments",
        }}
      />

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading failed payments queue...
        </div>
      ) : queue.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200">
          <EmptyState
            title="Zero failed payments in queue"
            description="All payment attempts have either succeeded or expired."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const isCopied = !!copiedLinkMap[item.orderId];
            const isReservationActive = item.stockReservationRemainingMinutes > 0;

            return (
              <div
                key={item.transactionId}
                className="p-5 bg-white rounded-xl border border-red-200 shadow-sm space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-mono font-bold text-red-600">
                      {formatPaise(item.amountPaise, true)}{" "}
                      <span className="text-sm font-normal text-slate-500">failed</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Link
                        href={`/admin/orders/${item.orderId}`}
                        className="font-mono font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        #{item.orderNumber}
                        <ExternalLink size={12} />
                      </Link>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-800 font-medium">{item.customerName}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-slate-500">{item.customerPhone}</span>
                    </div>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(item.createdAt).toLocaleString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </div>

                {/* Gateway Error (Verbatim per PAY-08) */}
                <div className="p-3 bg-red-50/70 rounded-lg border border-red-100 text-xs">
                  <div className="text-red-900 font-semibold mb-0.5">
                    Gateway Error Reason (Verbatim):
                  </div>
                  <div className="text-red-800 font-mono">
                    "{item.failureReason}"{" "}
                    {item.failureCode && (
                      <span className="text-[11px] text-red-600">
                        [{item.failureCode}]
                      </span>
                    )}
                  </div>
                </div>

                {/* Status & Reservation Countdown */}
                <div className="flex flex-wrap items-center justify-between text-xs p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600">
                      Method: <strong>{item.method}</strong> ({item.gateway})
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600">
                      Order: <strong>{item.orderStatus}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock size={14} className={isReservationActive ? "text-amber-600" : "text-slate-400"} />
                    {isReservationActive ? (
                      <span className="text-amber-800 font-semibold">
                        Stock reserved {item.stockReservationRemainingMinutes}m more (INV-05)
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Reservation window elapsed (Order CANCELLED / stock released)
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400 italic">
                    Auto-retry disabled to protect customer card limits. Manual link recovery recommended.
                  </div>

                  <div className="flex items-center gap-2">
                    {item.customerPhone && item.customerPhone !== "N/A" && (
                      <a
                        href={`tel:${item.customerPhone}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <Phone size={13} />
                        Call customer
                      </a>
                    )}

                    <Link
                      href={`/admin/orders/${item.orderId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <XCircle size={13} />
                      Order actions
                    </Link>

                    <button
                      type="button"
                      disabled={copyingId === item.orderId}
                      onClick={() => handleCopyPaymentLink(item.orderId)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} className="text-emerald-300" />
                          Link copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy payment link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
