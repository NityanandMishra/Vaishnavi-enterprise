"use client";

import React, { useState, useEffect } from "react";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { formatPaise } from "@/lib/money";
import { useToast } from "@/components/admin/ui/Toast";
import {
  AlertTriangle,
  Clock,
  RotateCcw,
  Copy,
  Phone,
  ExternalLink,
  CheckCircle2,
  Package,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import ShipmentDetailDrawer from "./ShipmentDetailDrawer";

export default function StuckShipmentsQueue() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"NO_UPDATE" | "FAILED" | "RTO">("NO_UPDATE");
  const [loading, setLoading] = useState(true);
  const [queueData, setQueueData] = useState<{
    noUpdate48h: any[];
    failedDelivery: any[];
    rtoInProgress: any[];
    totalStuckCount: number;
  }>({
    noUpdate48h: [],
    failedDelivery: [],
    rtoInProgress: [],
    totalStuckCount: 0,
  });

  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shipments/stuck");
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch stuck shipments queue", "error");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied!`, "success");
  }

  async function handleRecordRtoReceived(shipmentId: string) {
    if (!confirm("Record this RTO parcel as received at warehouse? Stock will be restored.")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/rto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RECORD_RECEIVED" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record RTO receipt");
      }

      addToast("RTO received! Stock restored to warehouse inventory.", "success");
      fetchQueue();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestReattempt(shipmentId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "OUT_FOR_DELIVERY",
          reason: "Reattempt requested with courier partner",
          location: "Destination Delivery Hub",
        }),
      });

      if (!res.ok) throw new Error("Failed to request reattempt");
      addToast("Reattempt requested with courier!", "success");
      fetchQueue();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  const currentList =
    activeTab === "NO_UPDATE"
      ? queueData.noUpdate48h
      : activeTab === "FAILED"
      ? queueData.failedDelivery
      : queueData.rtoInProgress;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--gray-900)] dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Stuck Shipments Exception Queue
          </h1>
          <p className="text-xs text-[var(--gray-500)] mt-1">
            Parcels with no courier scan for over 48 hours, delivery failures, or returns in transit.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
          title="Refresh queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* SEGMENTED TABS */}
      <div className="flex border-b border-[var(--gray-200)] dark:border-[var(--gray-700)] space-x-2 text-xs">
        <button
          onClick={() => setActiveTab("NO_UPDATE")}
          className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "NO_UPDATE"
              ? "border-amber-500 text-amber-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          No update 48h+ ({queueData.noUpdate48h.length})
        </button>

        <button
          onClick={() => setActiveTab("FAILED")}
          className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "FAILED"
              ? "border-rose-600 text-rose-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Failed delivery ({queueData.failedDelivery.length})
        </button>

        <button
          onClick={() => setActiveTab("RTO")}
          className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "RTO"
              ? "border-purple-600 text-purple-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          RTO in progress ({queueData.rtoInProgress.length})
        </button>
      </div>

      {/* QUEUE CARDS */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-500 animate-pulse">
            Scanning stuck shipments...
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-16 text-center border border-dashed rounded-xl bg-white dark:bg-[var(--gray-900)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No stuck shipments in this category
            </div>
            <div className="text-xs text-gray-400 mt-1">Everything is moving normally.</div>
          </div>
        ) : (
          currentList.map((s) => {
            const isCod = s.order.paymentMethod === "COD";

            return (
              <div
                key={s.id}
                className="p-5 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-3"
              >
                {/* CARD HEADER */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                      {s.shipmentNumber}
                    </span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Order #{s.order.orderNumber} · {s.order.customerName} · {s.order.deliveryCity}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                      {s.courier.name}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>

                {/* AWB & TIMESTAMPS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">AWB Number</span>
                    <div className="font-mono font-bold flex items-center gap-1.5 mt-0.5">
                      {s.awbNumber || "—"}
                      {s.awbNumber && (
                        <button
                          type="button"
                          onClick={() => copyText(s.awbNumber, "AWB")}
                          className="hover:text-blue-600"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block text-[11px]">Payment</span>
                    <span className="font-medium">
                      {isCod ? `COD: ₹${s.order.totalAmount.toFixed(2)}` : `Prepaid ₹${s.order.totalAmount.toFixed(2)}`}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block text-[11px]">Expected Delivery</span>
                    <span className="font-medium text-rose-600">
                      {s.expectedDeliveryDate
                        ? new Date(s.expectedDeliveryDate).toLocaleDateString()
                        : "Overdue"}
                    </span>
                  </div>
                </div>

                {/* STATUS NOTE */}
                <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Last event: {s.lastEventDescription || "Dispatched"}
                    {s.lastEventLocation ? ` (${s.lastEventLocation})` : ""}
                  </span>
                </div>

                {/* FAILED DELIVERY CONTEXT */}
                {s.status === "FAILED_DELIVERY" && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-900 dark:text-rose-200">
                    <strong>Delivery attempt failed:</strong> Customer unreachable or door locked.
                  </div>
                )}

                {/* RTO CONTEXT */}
                {s.status === "RTO" && (
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-lg text-xs text-purple-900 dark:text-purple-200">
                    <strong>RTO in progress:</strong> {s.rtoReason || "Returning to warehouse"}
                  </div>
                )}

                {/* CARD ACTIONS */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${s.order.customerPhone}`}
                      className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 font-medium"
                    >
                      <Phone className="w-3 h-3 text-emerald-600" /> Call Customer
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShipmentId(s.id);
                        setIsDetailOpen(true);
                      }}
                      className="px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
                    >
                      Update Status
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.status === "FAILED_DELIVERY" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRequestReattempt(s.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Request Reattempt
                      </button>
                    )}

                    {s.status === "RTO" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRecordRtoReceived(s.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Record RTO Received
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SHIPMENT DETAIL DRAWER */}
      <ShipmentDetailDrawer
        shipmentId={selectedShipmentId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdated={fetchQueue}
      />
    </div>
  );
}
