"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Drawer, StatusBadge } from "@/components/admin/ui";
import { formatPaise } from "@/lib/money";
import {
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Clock,
  RotateCcw,
} from "lucide-react";

interface TransactionDetailDrawerProps {
  transaction: any | null;
  isOpen: boolean;
  onClose: () => void;
  onInitiateRefund?: (orderId: string) => void;
  userRole?: string;
}

export default function TransactionDetailDrawer({
  transaction,
  isOpen,
  onClose,
  onInitiateRefund,
  userRole,
}: TransactionDetailDrawerProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);

  if (!transaction) return null;

  function handleCopy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  const isRefundable =
    transaction.status === "PAID" &&
    transaction.order?.paymentStatus !== "REFUNDED";

  const canRefund =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "FINANCE";

  const events = transaction.events || [];
  const refunds = transaction.refunds || [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="wide"
      title="Transaction Details"
      subtitle={`ID: ${transaction.id}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Link
            href={`/admin/orders/${transaction.orderId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            <ExternalLink size={14} />
            View order
          </Link>
          {canRefund && isRefundable && onInitiateRefund && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onInitiateRefund(transaction.orderId);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <RotateCcw size={14} />
              Initiate refund
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Top Amount & Status ── */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              Gross Amount
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
              {formatPaise(transaction.amountPaise, true)}
            </div>
          </div>
          <StatusBadge status={transaction.status} />
        </div>

        {/* ── Metadata Grid ── */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Order</span>
            <div className="mt-1 font-medium text-slate-900 flex items-center gap-1.5">
              <Link
                href={`/admin/orders/${transaction.orderId}`}
                className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-mono"
              >
                #{transaction.order?.orderNumber || transaction.orderId}
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          <div>
            <span className="text-slate-500">Customer</span>
            <div className="mt-1 font-medium text-slate-900">
              {transaction.order?.customerName || "Customer"}
              {transaction.order?.customerPhone && (
                <div className="text-slate-500 font-mono text-[11px]">
                  {transaction.order.customerPhone}
                </div>
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-500">Gateway</span>
            <div className="mt-1 font-semibold text-slate-900">
              {transaction.gateway}
            </div>
          </div>

          <div>
            <span className="text-slate-500">Method</span>
            <div className="mt-1 font-medium text-slate-900">
              {transaction.method}
              {transaction.cardLastFour && (
                <span className="ml-1 text-slate-500 font-mono">
                  •••• {transaction.cardLastFour}
                </span>
              )}
              {transaction.upiVpaMasked && (
                <span className="ml-1 text-slate-500 font-mono">
                  ({transaction.upiVpaMasked})
                </span>
              )}
              {transaction.bankName && (
                <span className="ml-1 text-slate-500">({transaction.bankName})</span>
              )}
            </div>
          </div>

          <div className="col-span-2">
            <span className="text-slate-500">Gateway Transaction ID</span>
            <div className="mt-1 flex items-center justify-between p-2 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
              <span>{transaction.gatewayTransactionId || "N/A"}</span>
              {transaction.gatewayTransactionId && (
                <button
                  type="button"
                  onClick={() => handleCopy(transaction.gatewayTransactionId)}
                  className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[10px]"
                >
                  {copiedId ? (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <Check size={12} /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Copy size={12} /> Copy
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-500">Initiated At</span>
            <div className="mt-1 font-mono text-slate-800">
              {new Date(transaction.initiatedAt || transaction.createdAt).toLocaleString(
                "en-IN"
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-500">Completed At</span>
            <div className="mt-1 font-mono text-slate-800">
              {transaction.completedAt
                ? new Date(transaction.completedAt).toLocaleString("en-IN")
                : "—"}
            </div>
          </div>
        </div>

        {/* ── Gateway Response ── */}
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
          <div className="text-xs font-semibold text-slate-900 mb-2">
            Gateway Response
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <span className="text-slate-500">Response Code:</span>{" "}
              <span className="font-mono font-medium text-slate-800">
                {transaction.gatewayResponseCode || "SUCCESS"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Response Message:</span>{" "}
              <span className="text-slate-800">
                {transaction.gatewayResponseMessage || "Captured successfully"}
              </span>
            </div>
          </div>

          {events[0]?.rawPayload && (
            <div>
              <button
                type="button"
                onClick={() => setShowRawPayload(!showRawPayload)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                {showRawPayload ? (
                  <>
                    <ChevronUp size={12} /> Hide raw response
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> View raw response
                  </>
                )}
              </button>
              {showRawPayload && (
                <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto max-h-48">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(events[0].rawPayload), null, 2);
                    } catch (_) {
                      return events[0].rawPayload;
                    }
                  })()}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* ── Event Log ── */}
        <div>
          <div className="text-xs font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
            <Clock size={14} className="text-slate-500" />
            Event Log & Provenance
          </div>
          {events.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded">
              No gateway events logged.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {events.map((ev: any) => (
                <div key={ev.id} className="p-3 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-semibold text-slate-800 capitalize">
                      {ev.eventType.replace(".", " ")}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="font-mono text-slate-600">{ev.toStatus}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    {ev.signatureVerified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded border border-emerald-200">
                        <ShieldCheck size={11} /> verified ✓
                      </span>
                    )}
                    <span className="font-mono text-[11px]">
                      {new Date(ev.processedAt || ev.createdAt).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Associated Refunds ── */}
        <div>
          <div className="text-xs font-semibold text-slate-900 mb-2">
            Refunds Against Transaction
          </div>
          {refunds.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded">
              No refunds against this transaction.
            </div>
          ) : (
            <div className="space-y-2">
              {refunds.map((r: any) => (
                <div
                  key={r.id}
                  className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-medium text-slate-800">
                      {r.refundNumber}
                    </span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">{r.reasonCode}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900">
                      {formatPaise(r.amountPaise, true)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
