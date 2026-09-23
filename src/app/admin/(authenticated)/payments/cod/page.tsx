"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, EmptyState, Modal } from "@/components/admin/ui";
import { RecordRemittanceModal } from "@/components/admin/payments";
import { formatPaise } from "@/lib/money";
import {
  Truck,
  Building2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type CodTab = "awaiting_delivery" | "collected" | "remittances" | "discrepancies";

export default function CodCollectionsPage() {
  const [activeTab, setActiveTab] = useState<CodTab>("awaiting_delivery");
  const [loading, setLoading] = useState(true);

  // Data states
  const [pendingData, setPendingData] = useState<any>(null);
  const [remittances, setRemittances] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);

  // Remittance Modal state
  const [remittanceModalData, setRemittanceModalData] = useState<{
    isOpen: boolean;
    courierName: string;
    expectedPaise: number;
    orderCount: number;
    orderIds: string[];
  }>({
    isOpen: false,
    courierName: "",
    expectedPaise: 0,
    orderCount: 0,
    orderIds: [],
  });

  // Resolve Discrepancy Modal state
  const [resolvingItem, setResolvingItem] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collapsed courier groups
  const [collapsedCouriers, setCollapsedCouriers] = useState<Record<string, boolean>>({});

  function toggleCourier(courier: string) {
    setCollapsedCouriers((prev) => ({ ...prev, [courier]: !prev[courier] }));
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingRes, remitRes, discRes] = await Promise.all([
        fetch("/api/admin/cod/pending"),
        fetch("/api/admin/cod/remittances"),
        fetch("/api/admin/cod/discrepancies"),
      ]);

      const [pendingJson, remitJson, discJson] = await Promise.all([
        pendingRes.json(),
        remitRes.json(),
        discRes.json(),
      ]);

      if (pendingJson.data) setPendingData(pendingJson.data);
      if (remitJson.data) setRemittances(remitJson.data);
      if (discJson.data) setDiscrepancies(discJson.data);
    } catch (err) {
      console.error("Failed to load COD data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const awaitingDeliveryCount = pendingData?.awaitingDelivery?.count || 0;
  const collectedCount = pendingData?.collectedNotRemitted?.totalCount || 0;
  const discrepanciesCount = discrepancies.length;

  async function handleResolveDiscrepancy(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingItem || !resolutionNote.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/cod/discrepancies/${resolvingItem.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve discrepancy");

      setResolvingItem(null);
      setResolutionNote("");
      loadData();
    } catch (err: any) {
      alert(`Error resolving: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="COD Collections & Remittance"
        subtitle="Track cash on delivery from courier dispatch to bank remittance"
        secondaryAction={{
          label: "Back to payments",
          href: "/admin/payments",
        }}
      />

      {/* ── Top Tabs ── */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-medium overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("awaiting_delivery")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "awaiting_delivery"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Awaiting delivery</span>
          <span className="text-slate-400">({awaitingDeliveryCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("collected")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "collected"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Collected, not remitted</span>
          {collectedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
              {collectedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("remittances")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "remittances"
              ? "border-slate-800 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Remittances history</span>
          <span className="text-slate-400">({remittances.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("discrepancies")}
          className={`pb-3 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "discrepancies"
              ? "border-red-600 text-red-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Discrepancies</span>
          {discrepanciesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
              {discrepanciesCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading COD collections data...
        </div>
      ) : activeTab === "awaiting_delivery" ? (
        /* ── TAB 1: Awaiting Delivery ── */
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-xs text-indigo-950">
              <Truck size={18} className="text-indigo-600" />
              <span>
                <strong>
                  {formatPaise(pendingData?.awaitingDelivery?.totalAmountPaise || 0, false)}
                </strong>{" "}
                out with couriers across {awaitingDeliveryCount} order
                {awaitingDeliveryCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {pendingData?.awaitingDelivery?.items?.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No COD orders awaiting delivery"
                  description="All dispatched COD orders have been delivered or returned."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Amount Due</th>
                      <th className="py-3 px-4">Courier</th>
                      <th className="py-3 px-4">AWB / Tracking</th>
                      <th className="py-3 px-4">Dispatched</th>
                      <th className="py-3 px-4">Expected Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingData?.awaitingDelivery?.items?.map((item: any) => (
                      <tr key={item.orderId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${item.orderId}`}
                            className="text-indigo-600 hover:underline"
                          >
                            #{item.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{item.customerName}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {item.customerPhone}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatPaise(item.amountPaise, true)}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {item.courier}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {item.awb}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {item.dispatchedAt
                            ? new Date(item.dispatchedAt).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {item.expectedDeliveryAt
                            ? new Date(item.expectedDeliveryAt).toLocaleDateString("en-IN")
                            : "Standard SLA"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "collected" ? (
        /* ── TAB 2: Collected, Not Remitted (Grouped by Courier) ── */
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-xs text-emerald-950">
              <Building2 size={18} className="text-emerald-600" />
              <span>
                <strong>
                  {formatPaise(pendingData?.collectedNotRemitted?.totalAmountPaise || 0, false)}
                </strong>{" "}
                cash collected awaiting bank remittance across {collectedCount} order
                {collectedCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {pendingData?.collectedNotRemitted?.groups?.length === 0 ? (
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <EmptyState
                title="No unremitted collections"
                description="All collected courier cash has been reconciled and remitted."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {pendingData?.collectedNotRemitted?.groups?.map((group: any) => {
                const isCollapsed = collapsedCouriers[group.courier];

                return (
                  <div
                    key={group.courier}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                  >
                    {/* Courier Header Group */}
                    <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
                      <div
                        className="flex items-center gap-2 cursor-pointer select-none"
                        onClick={() => toggleCourier(group.courier)}
                      >
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        <span className="font-bold text-sm text-slate-900">
                          {group.courier}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-600 font-medium">
                          {group.orderCount} order{group.orderCount === 1 ? "" : "s"}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs font-mono font-bold text-slate-900">
                          {formatPaise(group.totalExpectedPaise, true)} expected
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setRemittanceModalData({
                            isOpen: true,
                            courierName: group.courier,
                            expectedPaise: group.totalExpectedPaise,
                            orderCount: group.orderCount,
                            orderIds: group.orders.map((o: any) => o.orderId),
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
                      >
                        Record remittance for {group.courier}
                      </button>
                    </div>

                    {/* Orders Table */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white border-b border-slate-100 text-slate-500 uppercase font-semibold text-[10px]">
                            <tr>
                              <th className="py-2.5 px-4">Order</th>
                              <th className="py-2.5 px-4">Customer</th>
                              <th className="py-2.5 px-4">Delivered Date</th>
                              <th className="py-2.5 px-4 text-right">Cash Collected</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.orders.map((ord: any) => (
                              <tr key={ord.collectionId} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 font-mono font-medium">
                                  <Link
                                    href={`/admin/orders/${ord.orderId}`}
                                    className="text-indigo-600 hover:underline"
                                  >
                                    #{ord.orderNumber}
                                  </Link>
                                </td>
                                <td className="py-2.5 px-4 text-slate-800">
                                  {ord.customerName}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-slate-500">
                                  {ord.deliveredAt
                                    ? new Date(ord.deliveredAt).toLocaleDateString("en-IN")
                                    : "Delivered"}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                  {formatPaise(ord.amountPaise, true)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "remittances" ? (
        /* ── TAB 3: Remittances History ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {remittances.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No remittances recorded"
                description="Recorded courier cash settlements will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Courier</th>
                    <th className="py-3 px-4 text-right">Expected</th>
                    <th className="py-3 px-4 text-right">Received</th>
                    <th className="py-3 px-4 text-right">Variance</th>
                    <th className="py-3 px-4">Bank Ref / UTR</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reconciled By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remittances.map((r) => {
                    const hasVariance = r.variancePaise !== 0;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(r.remittanceDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {r.courierId}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPaise(r.expectedPaise, true)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatPaise(r.receivedPaise, true)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                            hasVariance ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {hasVariance ? (r.variancePaise > 0 ? "-" : "+") : ""}
                          {formatPaise(Math.abs(r.variancePaise), true)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {r.bankReference || "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {r.reconciledByName || "Staff"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── TAB 4: Discrepancies ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {discrepancies.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Zero COD discrepancies"
                description="All delivered COD orders have matching cash accounted for."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Expected</th>
                    <th className="py-3 px-4 text-right">Collected</th>
                    <th className="py-3 px-4 text-right">Variance</th>
                    <th className="py-3 px-4">Note / Investigation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discrepancies.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${d.orderId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          #{d.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{d.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{d.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                          {d.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatPaise(d.expectedPaise, true)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatPaise(d.collectedPaise, true)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 whitespace-nowrap">
                        -{formatPaise(d.variancePaise, true)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs">
                        {d.discrepancyNote}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setResolvingItem(d)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Remittance Modal ── */}
      <RecordRemittanceModal
        isOpen={remittanceModalData.isOpen}
        onClose={() => setRemittanceModalData({ ...remittanceModalData, isOpen: false })}
        courierName={remittanceModalData.courierName}
        expectedPaise={remittanceModalData.expectedPaise}
        orderCount={remittanceModalData.orderCount}
        orderIds={remittanceModalData.orderIds}
        onSuccess={loadData}
      />

      {/* ── Resolve Discrepancy Modal ── */}
      {resolvingItem && (
        <Modal
          isOpen={!!resolvingItem}
          onClose={() => setResolvingItem(null)}
          maxWidth="md"
          title={`Resolve Discrepancy — #${resolvingItem.orderNumber}`}
          subtitle={`Variance: -${formatPaise(resolvingItem.variancePaise, true)}`}
        >
          <form onSubmit={handleResolveDiscrepancy} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Provide an explanatory resolution note. Resolving appends a permanent resolution record
              and moves the collection out of the discrepancy queue.
            </p>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Resolution Note <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Courier confirmed cash collected and deposited under ref UTR9988..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!resolutionNote.trim() || isSubmitting}
                className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 shadow-sm transition-colors"
              >
                {isSubmitting ? "Resolving..." : "Save Resolution"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
