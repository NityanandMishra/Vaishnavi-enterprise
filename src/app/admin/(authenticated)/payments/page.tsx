"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  Pagination,
} from "@/components/admin/ui";
import {
  TransactionDetailDrawer,
  RefundInitiationModal,
} from "@/components/admin/payments";
import { formatPaise } from "@/lib/money";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  RefreshCw,
} from "lucide-react";

export default function PaymentsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [gateway, setGateway] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Drawers and Modals
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await fetch("/api/admin/payments/summary");
      const json = await res.json();
      if (json.data) setSummary(json.data);
    } catch (err) {
      console.error("Failed to fetch payment summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(status !== "ALL" && { status }),
        ...(method !== "ALL" && { method }),
        ...(gateway !== "ALL" && { gateway }),
      });

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setTransactions(json.data);
        setTotalPages(json.meta?.totalPages || 1);
        setTotalCount(json.meta?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, method, gateway]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleTileClick(filterStatus: string) {
    setStatus(filterStatus);
    setPage(1);
  }

  function handleOpenTxn(txn: any) {
    setSelectedTxn(txn);
    setIsDrawerOpen(true);
  }

  function handleInitiateRefund(orderId: string) {
    setRefundOrderId(orderId);
    setIsRefundModalOpen(true);
  }

  const totalCollectedFormatted = summary
    ? formatPaise(summary.collectedThisMonthPaise, false)
    : "₹0";
  const attentionCount = summary?.attentionStrips?.length || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Payments"
        subtitle={`${totalCollectedFormatted} collected this month · ${attentionCount} need${
          attentionCount === 1 ? "s" : ""
        } attention`}
        primaryAction={{
          label: "Import settlement",
          href: "/admin/payments/reconciliation",
          icon: FileSpreadsheet,
        }}
        secondaryAction={{
          label: "Export transactions",
          href: "/api/admin/payments/export",
          icon: Download,
        }}
        overflowActions={[
          {
            label: "Refund queue",
            href: "/admin/payments/refunds",
            icon: RotateCcw,
          },
        ]}
      />

      {/* ── Attention Strips (Ordered by Severity) ── */}
      {summary?.attentionStrips && summary.attentionStrips.length > 0 && (
        <div className="space-y-2">
          {summary.attentionStrips.slice(0, 3).map((strip: any) => (
            <div
              key={strip.id}
              className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                strip.severity === "danger"
                  ? "bg-red-50/80 border-red-200 text-red-900"
                  : "bg-amber-50/80 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2.5 font-medium">
                {strip.severity === "danger" ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse flex-shrink-0" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                )}
                <span>{strip.message}</span>
              </div>
              <Link
                href={strip.actionHref}
                className={`font-semibold hover:underline inline-flex items-center gap-1 ${
                  strip.severity === "danger" ? "text-red-700" : "text-amber-800"
                }`}
              >
                {strip.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ── Stat Row (Filters Table on Click) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* COLLECTED */}
        <div
          onClick={() => handleTileClick("PAID")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "PAID"
              ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Collected
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
            {summary ? formatPaise(summary.collectedThisMonthPaise, false) : "₹0"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            this month · {summary?.collectedCount || 0} transactions
          </div>
        </div>

        {/* PENDING */}
        <div
          onClick={() => handleTileClick("PENDING")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "PENDING"
              ? "border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pending
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
            {summary ? formatPaise(summary.pendingPaise, false) : "₹0"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary?.pendingCount || 0} orders awaiting payment
          </div>
        </div>

        {/* REFUNDED */}
        <div
          onClick={() => handleTileClick("REFUNDED")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "REFUNDED"
              ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Refunded
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
            {summary ? formatPaise(summary.refundedThisMonthPaise, false) : "₹0"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            this month · {summary?.refundedCount || 0} refunds
          </div>
        </div>

        {/* COD DUE */}
        <Link
          href="/admin/payments/cod"
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              COD Due
            </span>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
            {summary ? formatPaise(summary.codDuePaise, false) : "₹0"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary?.codDueCount || 0} orders out with couriers
          </div>
        </Link>
      </div>

      {/* ── Method Breakdown (Single Horizontal Stacked Bar) ── */}
      {summary?.methodBreakdown && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium">
            <span className="text-slate-900 font-semibold">Payment Methods Share:</span>
            <div className="flex items-center gap-4">
              {summary.methodBreakdown.map((m: any) => (
                <span key={m.method} className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-sm ${
                      m.method === "UPI"
                        ? "bg-indigo-600"
                        : m.method === "COD"
                        ? "bg-amber-500"
                        : m.method === "CARD"
                        ? "bg-sky-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span>
                    {m.label} <strong className="text-slate-900">{m.percentage}%</strong>
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            {summary.methodBreakdown.map((m: any) => {
              if (m.percentage <= 0) return null;
              const bgClass =
                m.method === "UPI"
                  ? "bg-indigo-600"
                  : m.method === "COD"
                  ? "bg-amber-500"
                  : m.method === "CARD"
                  ? "bg-sky-500"
                  : "bg-emerald-500";
              return (
                <div
                  key={m.method}
                  style={{ width: `${m.percentage}%` }}
                  className={`h-full ${bgClass} transition-all`}
                  title={`${m.label}: ${m.percentage}% (${formatPaise(m.amountPaise)})`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toolbar: Search & Filters ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search order #, txn id, phone, or amount..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          {/* Method Filter */}
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="COD">COD</option>
            <option value="CARD">Card</option>
            <option value="NETBANKING">Netbanking</option>
          </select>

          {/* Gateway Filter */}
          <select
            value={gateway}
            onChange={(e) => {
              setGateway(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Gateways</option>
            <option value="RAZORPAY">Razorpay</option>
            <option value="PAYU">PayU</option>
            <option value="CASHFREE">Cashfree</option>
            <option value="COD">COD (Courier)</option>
            <option value="MANUAL">Manual</option>
          </select>

          {(status !== "ALL" || method !== "ALL" || gateway !== "ALL" || search) && (
            <button
              type="button"
              onClick={() => {
                setStatus("ALL");
                setMethod("ALL");
                setGateway("ALL");
                setSearch("");
                setPage(1);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Transactions Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw size={20} className="mx-auto animate-spin mb-2 text-slate-400" />
            Loading transaction log...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No payments yet"
              description="Transactions appear here once orders are paid or attempted."
              actionLabel={
                status !== "ALL" || method !== "ALL" || search ? "Clear filters" : undefined
              }
              onAction={() => {
                setStatus("ALL");
                setMethod("ALL");
                setGateway("ALL");
                setSearch("");
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date/Time</th>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Txn ID</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => {
                  const isFailed = t.status === "FAILED";
                  const isRefunded =
                    t.status === "REFUNDED" || t.status === "PARTIALLY_REFUNDED";

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenTxn(t)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isFailed ? "border-l-4 border-l-red-500 bg-red-50/20" : ""
                      }`}
                    >
                      {/* DATE/TIME */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                        ,{" "}
                        {new Date(t.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* ORDER */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${t.orderId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-medium text-indigo-600 hover:underline inline-flex items-center gap-1"
                        >
                          #{t.orderNumber}
                        </Link>
                      </td>

                      {/* CUSTOMER */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{t.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {t.customerPhone}
                        </div>
                      </td>

                      {/* METHOD */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          <CreditCard size={11} className="text-slate-500" />
                          {t.method}
                          {t.cardLastFour && ` •••• ${t.cardLastFour}`}
                        </span>
                      </td>

                      {/* AMOUNT (Mono, right-aligned, tabular) */}
                      <td className="py-3 px-4 text-right font-mono font-medium whitespace-nowrap">
                        {isRefunded ? (
                          <div>
                            <span className="line-through text-slate-400">
                              {formatPaise(t.amountPaise, true)}
                            </span>
                            <div className="text-[10px] text-red-600 font-semibold">
                              - {formatPaise(t.refundedPaise, true)}
                            </div>
                          </div>
                        ) : (
                          <span
                            className={
                              isFailed
                                ? "text-red-700"
                                : t.status === "PAID"
                                ? "text-slate-900 font-bold"
                                : "text-slate-700"
                            }
                          >
                            {formatPaise(t.amountPaise, true)}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* TXN ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>
                            {t.gatewayTransactionId
                              ? t.gatewayTransactionId.slice(0, 14) + "…"
                              : "—"}
                          </span>
                          {t.gatewayTransactionId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(t.gatewayTransactionId);
                              }}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy transaction ID"
                            >
                              {copiedId === t.gatewayTransactionId ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* GATEWAY */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {t.gateway}
                      </td>

                      {/* ACTIONS */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTxn(t)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View
                          </button>
                          {t.status === "PAID" && (
                            <button
                              type="button"
                              onClick={() => handleInitiateRefund(t.orderId)}
                              className="text-xs text-slate-600 hover:text-slate-900"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200">
            <Pagination
              currentPage={page}
              totalItems={totalCount}
              pageSize={20}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ── Transaction Drawer (S2) ── */}
      <TransactionDetailDrawer
        transaction={selectedTxn}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onInitiateRefund={handleInitiateRefund}
      />

      {/* ── Refund Modal (S3) ── */}
      <RefundInitiationModal
        orderId={refundOrderId}
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSuccess={() => {
          fetchSummary();
          fetchTransactions();
        }}
      />
    </div>
  );
}
