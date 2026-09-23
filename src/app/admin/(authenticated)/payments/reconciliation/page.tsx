"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, EmptyState, Modal } from "@/components/admin/ui";
import { ResolveMismatchModal } from "@/components/admin/payments";
import { formatPaise, parsePaise } from "@/lib/money";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Search,
} from "lucide-react";

export default function ReconciliationPage() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [reconciliationData, setReconciliationData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter for mismatch list
  const [mismatchFilter, setMismatchFilter] = useState<"ALL" | "OPEN" | "RESOLVED" | "IGNORED">("OPEN");

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Resolve Modal state
  const [resolvingMismatchItem, setResolvingMismatchItem] = useState<any | null>(null);

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settlements");
      const json = await res.json();
      if (json.data) {
        setSettlements(json.data);
        if (json.data.length > 0 && !selectedSettlementId) {
          setSelectedSettlementId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch settlements:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSettlementId]);

  const fetchReconciliationDetails = useCallback(async (id: string) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`/api/admin/settlements/${id}/reconciliation`);
      const json = await res.json();
      if (json.data) {
        setReconciliationData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch reconciliation details:", err);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  useEffect(() => {
    if (selectedSettlementId) {
      fetchReconciliationDetails(selectedSettlementId);
    }
  }, [selectedSettlementId, fetchReconciliationDetails]);

  async function handleImportSample() {
    setIsImporting(true);
    try {
      const sampleSettlement = {
        gateway: "RAZORPAY",
        settlementId: `setl_${Date.now().toString(36)}`,
        settlementDate: new Date().toISOString(),
        bankReference: `UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        grossAmount: "482140.00",
        feesAmount: "9642.80",
        taxOnFeesAmount: "1735.70",
        netAmount: "470761.50",
        transactions: [
          {
            gatewayTransactionId: "pay_sample_01",
            amount: "1950.76",
            status: "PAID",
          },
          {
            gatewayTransactionId: "pay_sample_unknown_99",
            amount: "899.00",
            status: "PAID",
          },
          {
            gatewayTransactionId: "pay_sample_diff_02",
            orderNumber: "VE-2026-0891",
            amount: "1199.00",
            status: "PAID",
          },
        ],
      };

      const res = await fetch("/api/admin/settlements/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleSettlement),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to import settlement");

      setIsImportModalOpen(false);
      fetchSettlements();
      if (json.data?.settlement?.id) {
        setSelectedSettlementId(json.data.settlement.id);
      }
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  }

  const currentSettlement = reconciliationData?.settlement;
  const summary = reconciliationData?.summary;
  const allMismatches = reconciliationData?.mismatches || [];

  const filteredMismatches = allMismatches.filter((m: any) => {
    if (mismatchFilter === "ALL") return true;
    return m.status === mismatchFilter;
  });

  const openMismatchCount = allMismatches.filter((m: any) => m.status === "OPEN").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Gateway Settlement Reconciliation"
        subtitle="Match gateway settlements against platform transactions and resolve discrepancies"
        primaryAction={{
          label: "Import settlement",
          onClick: () => setIsImportModalOpen(true),
          icon: Upload,
        }}
        secondaryAction={{
          label: "Back to payments",
          href: "/admin/payments",
        }}
      />

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading settlements...
        </div>
      ) : settlements.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200">
          <EmptyState
            title="No settlement files imported"
            description="Import a gateway settlement file or import sample data to test reconciliation."
            actionLabel="Import Sample Settlement"
            onAction={handleImportSample}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column: Settlement Selector ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Imported Settlements
            </h3>
            <div className="space-y-2">
              {settlements.map((s) => {
                const isSelected = s.id === selectedSettlementId;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSettlementId(s.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-xs text-slate-900">
                        {s.settlementId}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono">
                        {new Date(s.settlementDate).toLocaleDateString("en-IN")}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatPaise(s.netPaise, true)}
                      </span>
                    </div>
                    {s.openMismatches > 0 && (
                      <div className="mt-2 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <AlertTriangle size={11} /> {s.openMismatches} mismatch
                        {s.openMismatches === 1 ? "" : "es"} need attention
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Column: Settlement Summary & Mismatches ── */}
          <div className="lg:col-span-2 space-y-6">
            {detailsLoading || !reconciliationData ? (
              <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                Loading settlement details...
              </div>
            ) : (
              <>
                {/* ── Settlement Summary Card ── */}
                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                        {currentSettlement.gateway} Settlement
                      </div>
                      <div className="font-mono font-bold text-lg text-slate-900">
                        {currentSettlement.settlementId} ·{" "}
                        {new Date(currentSettlement.settlementDate).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <StatusBadge status={currentSettlement.status} />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-700">
                      <span>Gross ({summary.totalTransactions} transactions)</span>
                      <span className="font-semibold text-slate-900">
                        {formatPaise(summary.grossPaise, true)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Gateway fees</span>
                      <span>− {formatPaise(summary.feesPaise, true)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>GST on fees (18%)</span>
                      <span>− {formatPaise(summary.taxOnFeesPaise, true)}</span>
                    </div>
                    <div className="border-t border-slate-200 my-1 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                      <span>Net expected</span>
                      <span>{formatPaise(summary.netExpectedPaise, true)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 text-xs">
                      <span>
                        Bank credit ({currentSettlement.bankReference || "UTR Verified"})
                      </span>
                      <span>{formatPaise(summary.bankCreditPaise, true)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-100 text-emerald-600">
                      <span>Variance</span>
                      <span>✓ {formatPaise(summary.variancePaise, true)} matched</span>
                    </div>
                  </div>
                </div>

                {/* ── Match Results Banner ── */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={16} />
                    <span>
                      <strong>{summary.matchedCount}</strong> transactions matched automatically
                    </span>
                  </div>
                  {openMismatchCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                      <AlertTriangle size={15} />
                      <span>{openMismatchCount} need attention</span>
                    </div>
                  ) : (
                    <div className="text-emerald-700 font-bold">
                      ✓ All discrepancies resolved
                    </div>
                  )}
                </div>

                {/* ── Mismatches Section ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Mismatches & Discrepancies ({filteredMismatches.length})
                    </h3>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setMismatchFilter("OPEN")}
                        className={`px-2 py-0.5 rounded ${
                          mismatchFilter === "OPEN"
                            ? "bg-amber-100 text-amber-800 font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Open ({openMismatchCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMismatchFilter("RESOLVED")}
                        className={`px-2 py-0.5 rounded ${
                          mismatchFilter === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800 font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => setMismatchFilter("IGNORED")}
                        className={`px-2 py-0.5 rounded ${
                          mismatchFilter === "IGNORED"
                            ? "bg-slate-200 text-slate-800 font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Ignored
                      </button>
                      <button
                        type="button"
                        onClick={() => setMismatchFilter("ALL")}
                        className={`px-2 py-0.5 rounded ${
                          mismatchFilter === "ALL"
                            ? "bg-indigo-100 text-indigo-800 font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {filteredMismatches.length === 0 ? (
                    <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      No mismatches in this view.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredMismatches.map((m: any) => (
                        <div
                          key={m.id}
                          className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  {m.mismatchType.replace(/_/g, " ")}
                                </span>
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {m.gatewayTxnId || "N/A"}
                                </span>
                              </div>
                              {m.orderNumber && (
                                <div className="text-xs text-slate-600 mt-1">
                                  Order:{" "}
                                  <Link
                                    href={`/admin/orders/${m.transaction?.orderId || ""}`}
                                    className="font-mono text-indigo-600 hover:underline"
                                  >
                                    #{m.orderNumber}
                                  </Link>
                                </div>
                              )}
                            </div>
                            <StatusBadge status={m.status} />
                          </div>

                          <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 rounded border border-slate-100 text-xs font-mono">
                            <div>
                              <span className="text-slate-500 text-[10px]">Gateway Amount:</span>
                              <div className="font-semibold text-slate-900">
                                {m.gatewayAmountPaise
                                  ? formatPaise(m.gatewayAmountPaise, true)
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px]">Platform Amount:</span>
                              <div className="font-semibold text-slate-900">
                                {m.platformAmountPaise
                                  ? formatPaise(m.platformAmountPaise, true)
                                  : "—"}
                              </div>
                            </div>
                          </div>

                          {m.resolutionNote && (
                            <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-xs text-emerald-900">
                              <span className="font-semibold">Resolution Note: </span>
                              {m.resolutionNote}
                              <span className="text-slate-400 block text-[10px] mt-0.5">
                                Resolved by {m.resolvedByName || "Staff"} on{" "}
                                {new Date(m.resolvedAt).toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}

                          {m.status === "OPEN" && (
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setResolvingMismatchItem(m)}
                                className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                Resolve / Ignore
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Import Settlement Modal ── */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          maxWidth="md"
          title="Import Gateway Settlement"
          subtitle="Upload settlement data from Razorpay, PayU, or Cashfree"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Upload a settlement file or generate a test settlement reconciliation batch.
            </p>

            <button
              type="button"
              disabled={isImporting}
              onClick={handleImportSample}
              className="w-full p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-center transition-colors block"
            >
              <FileSpreadsheet size={24} className="mx-auto text-indigo-600 mb-1" />
              <div className="font-semibold text-indigo-900">
                {isImporting ? "Importing sample batch..." : "Import Sample Settlement Batch"}
              </div>
              <div className="text-[11px] text-indigo-600 mt-0.5">
                Generates sample Razorpay settlement with 3 matched/mismatched transactions
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* ── Resolve Mismatch Modal ── */}
      <ResolveMismatchModal
        item={resolvingMismatchItem}
        isOpen={!!resolvingMismatchItem}
        onClose={() => setResolvingMismatchItem(null)}
        onSuccess={() => {
          if (selectedSettlementId) fetchReconciliationDetails(selectedSettlementId);
          fetchSettlements();
        }}
      />
    </div>
  );
}
