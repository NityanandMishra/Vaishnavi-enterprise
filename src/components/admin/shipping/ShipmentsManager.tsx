"use client";

import React, { useState, useEffect } from "react";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useToast } from "@/components/admin/ui/Toast";
import {
  Truck,
  AlertTriangle,
  Clock,
  Printer,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Copy,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  FileText,
  Package,
} from "lucide-react";
import ShipmentDetailDrawer from "./ShipmentDetailDrawer";
import CreateShipmentDrawer from "./CreateShipmentDrawer";
import Link from "next/link";
import { formatPaise } from "@/lib/money";

interface ShipmentItem {
  id: string;
  shipmentNumber: string;
  awbNumber: string | null;
  status: string;
  weightGrams: number;
  shippingChargePaise: number;
  codAmountPaise: number;
  isStuck: boolean;
  expectedDeliveryDate: string | null;
  lastEventAt: string | null;
  lastEventDescription: string | null;
  lastEventLocation: string | null;
  createdAt: string;
  courier: {
    id: string;
    name: string;
    code: string;
  };
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPincode: string;
    paymentMethod: string;
    totalAmount: number;
    items: Array<{ id: string; quantity: number }>;
  };
  lines: Array<{
    id: string;
    quantity: number;
    orderLine: {
      id: string;
      productName: string;
      quantity: number;
    };
  }>;
}

export default function ShipmentsManager() {
  const { addToast } = useToast();

  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [counts, setCounts] = useState({
    readyToShip: 0,
    dispatched: 0,
    inTransit: 0,
    outForDelivery: 0,
    exceptions: 0,
    delivered: 0,
    rto: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Drawers
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [orderForNewShipment, setOrderForNewShipment] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Manifest modal
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
  const [manifestCourierId, setManifestCourierId] = useState("");
  const [manifestDate, setManifestDate] = useState(new Date().toISOString().split("T")[0]);
  const [manifestLoading, setManifestLoading] = useState(false);

  useEffect(() => {
    fetchCouriers();
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [activeTab, selectedCourier]);

  async function fetchCouriers() {
    try {
      const res = await fetch("/api/admin/couriers");
      if (res.ok) {
        const data = await res.json();
        setCouriers(data.couriers || []);
        if (data.couriers && data.couriers.length > 0) {
          setManifestCourierId(data.couriers[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchShipments() {
    setLoading(true);
    try {
      let url = `/api/admin/shipments?limit=100`;
      if (activeTab === "READY") url += `&status=READY_TO_SHIP`;
      else if (activeTab === "DISPATCHED") url += `&status=DISPATCHED`;
      else if (activeTab === "IN_TRANSIT") url += `&status=IN_TRANSIT`;
      else if (activeTab === "OUT_FOR_DELIVERY") url += `&status=OUT_FOR_DELIVERY`;
      else if (activeTab === "EXCEPTIONS") url += `&status=EXCEPTIONS`;
      else if (activeTab === "DELIVERED") url += `&status=DELIVERED`;
      else if (activeTab === "RTO") url += `&status=RTO_GROUP`;

      if (selectedCourier !== "ALL") url += `&courierId=${selectedCourier}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch shipments", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchShipments();
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied!`, "success");
  }

  function toggleSelectAll() {
    if (selectedIds.length === shipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(shipments.map((s) => s.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function formatTimeAgo(dateString: string | null) {
    if (!dateString) return "No events";
    const ms = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  async function handleCreateManifest() {
    if (!manifestCourierId) {
      addToast("Select a courier for the manifest", "error");
      return;
    }

    setManifestLoading(true);
    try {
      const res = await fetch("/api/admin/manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courierId: manifestCourierId,
          manifestDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create manifest");
      }

      const data = await res.json();
      addToast(`Manifest ${data.manifest.manifestNumber} created!`, "success");
      setIsManifestModalOpen(false);
      window.open(data.manifest.pdfUrl, "_blank");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setManifestLoading(false);
    }
  }

  const stuckCount = counts.exceptions;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--gray-900)] dark:text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-blue-600" />
            Shipments
          </h1>
          <p className="text-xs text-[var(--gray-500)] mt-1">
            {counts.readyToShip} ready to ship · {counts.inTransit} in transit · {stuckCount} exceptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManifestModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" /> Create Manifest
          </button>

          <Link
            href="/admin/shipping/calculator"
            className="px-3 py-2 text-xs font-medium border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)] flex items-center gap-1.5"
          >
            Rate Calculator
          </Link>
        </div>
      </div>

      {/* ALERT STRIP (CONDITIONAL) */}
      {stuckCount > 0 && (
        <div className="space-y-2">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <strong>{stuckCount} shipment{stuckCount > 1 ? "s" : ""}</strong> have had no courier update for over 48 hours or failed delivery.
            </div>
            <Link
              href="/admin/shipments/stuck"
              className="font-semibold underline hover:text-rose-700 flex items-center gap-1"
            >
              Review queue →
            </Link>
          </div>
        </div>
      )}

      {/* STATUS TABS */}
      <div className="flex border-b border-[var(--gray-200)] dark:border-[var(--gray-700)] overflow-x-auto space-x-1 text-xs">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "ALL"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          All Shipments
        </button>

        <button
          onClick={() => setActiveTab("READY")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "READY"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          Ready to ship
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.readyToShip}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("DISPATCHED")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "DISPATCHED"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          Dispatched
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.dispatched}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("IN_TRANSIT")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "IN_TRANSIT"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          In transit
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.inTransit}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("OUT_FOR_DELIVERY")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "OUT_FOR_DELIVERY"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          Out for delivery
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.outForDelivery}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("EXCEPTIONS")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "EXCEPTIONS"
              ? "border-rose-600 text-rose-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          Exceptions
          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 rounded-full text-[10px] font-bold">
            {counts.exceptions}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("DELIVERED")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "DELIVERED"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          Delivered
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.delivered}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("RTO")}
          className={`px-3.5 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "RTO"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-[var(--gray-500)] hover:text-[var(--gray-900)] dark:hover:text-white"
          }`}
        >
          RTO
          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 rounded-full text-[10px]">
            {counts.rto}
          </span>
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--gray-400)]" />
          <input
            type="text"
            placeholder="Search AWB, order no, or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg bg-white dark:bg-[var(--gray-800)]"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCourier}
            onChange={(e) => setSelectedCourier(e.target.value)}
            className="px-3 py-2 text-xs border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg bg-white dark:bg-[var(--gray-800)]"
          >
            <option value="ALL">All Couriers</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
          <span className="font-semibold text-blue-900 dark:text-blue-300">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                selectedIds.forEach((id) => window.open(`/api/admin/shipments/${id}/label`, "_blank"));
              }}
              className="px-2.5 py-1 bg-white dark:bg-gray-800 border rounded shadow-sm hover:bg-gray-50 flex items-center gap-1 font-medium"
            >
              <Printer className="w-3 h-3" /> Print labels
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline ml-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* TABLE (DESKTOP) */}
      <div className="hidden md:block border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl overflow-hidden bg-white dark:bg-[var(--gray-900)] shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--gray-50)] dark:bg-[var(--gray-800)] border-b border-[var(--gray-200)] dark:border-[var(--gray-700)] text-[var(--gray-500)] uppercase font-semibold">
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.length === shipments.length && shipments.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded text-blue-600 w-3.5 h-3.5"
                />
              </th>
              <th className="p-3 font-semibold">Shipment</th>
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold">Items</th>
              <th className="p-3 font-semibold">Courier</th>
              <th className="p-3 font-semibold">AWB</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Last Event</th>
              <th className="p-3 font-semibold">Expected</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500 animate-pulse">
                  Loading shipments...
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-gray-500">
                  <Package className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <div className="font-semibold text-gray-700 dark:text-gray-300">
                    No shipments found
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Packed orders will appear here ready to ship.
                  </div>
                </td>
              </tr>
            ) : (
              shipments.map((s) => {
                const isSelected = selectedIds.includes(s.id);
                const totalOrderItems = s.order.items.reduce((sum, item) => sum + item.quantity, 0);
                const shippedInThis = s.lines.reduce((sum, l) => sum + l.quantity, 0);
                const isPartial = shippedInThis < totalOrderItems;
                const isFailed = s.status === "FAILED_DELIVERY";
                const isStuckRow = s.isStuck && !isFailed;

                return (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedShipmentId(s.id);
                      setIsDetailOpen(true);
                    }}
                    className={`hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)]/60 cursor-pointer transition-colors ${
                      isStuckRow
                        ? "border-l-4 border-l-amber-500"
                        : isFailed
                        ? "border-l-4 border-l-rose-500"
                        : ""
                    }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(s.id)}
                        className="rounded text-blue-600 w-3.5 h-3.5"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-mono font-bold text-gray-900 dark:text-white">
                        {s.shipmentNumber}
                      </div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                        #{s.order.orderNumber}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {s.order.customerName}
                      </div>
                      <div className="text-[11px] text-[var(--gray-400)]">
                        {s.order.deliveryCity}, {s.order.deliveryState}
                      </div>
                    </td>

                    <td className="p-3">
                      {isPartial ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {shippedInThis} of {totalOrderItems} items
                        </span>
                      ) : (
                        <span className="text-[var(--gray-600)] dark:text-gray-300">
                          {shippedInThis} items
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-1 rounded text-[11px] font-medium bg-[var(--gray-100)] dark:bg-[var(--gray-800)]">
                        {s.courier.name}
                      </span>
                    </td>

                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      {s.awbNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                            {s.awbNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(s.awbNumber!, "AWB")}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-400"
                            title="Copy AWB"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Pending</span>
                      )}
                    </td>

                    <td className="p-3">
                      <StatusBadge status={s.status} />
                    </td>

                    {/* LAST EVENT: CRITICAL S1 REQUIREMENT */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        {isStuckRow && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                        {isFailed && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>
                          {s.lastEventDescription || s.status}
                          {s.lastEventLocation ? ` · ${s.lastEventLocation}` : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {formatTimeAgo(s.lastEventAt)}
                      </div>
                    </td>

                    <td className="p-3">
                      {s.expectedDeliveryDate ? (
                        <span className="text-gray-600 dark:text-gray-300">
                          {new Date(s.expectedDeliveryDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/admin/shipments/${s.id}/label`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"
                          title="Print label"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShipmentId(s.id);
                            setIsDetailOpen(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-blue-600"
                          title="View details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE LIST (<768px): Card Format with 44px AWB copy tap target */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-500 animate-pulse">
            Loading shipments...
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 border rounded-xl">
            No shipments found
          </div>
        ) : (
          shipments.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                setSelectedShipmentId(s.id);
                setIsDetailOpen(true);
              }}
              className="border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl p-4 bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-3 cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-sm">{s.shipmentNumber}</span>
                <span className="text-xs text-blue-600 font-medium">#{s.order.orderNumber}</span>
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-300">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {s.order.customerName}
                </div>
                <div>{s.order.deliveryCity}, {s.order.deliveryState}</div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs">{s.courier.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.awbNumber && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(s.awbNumber!, "AWB");
                    }}
                    className="min-h-[44px] min-w-[44px] px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-500 pt-1">
                {s.lastEventDescription || s.status} · {formatTimeAgo(s.lastEventAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* S3 SHIPMENT DETAIL DRAWER */}
      <ShipmentDetailDrawer
        shipmentId={selectedShipmentId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onCreateSecondShipment={(order) => {
          setOrderForNewShipment(order);
          setIsCreateOpen(true);
        }}
        onUpdated={fetchShipments}
      />

      {/* S2 CREATE SHIPMENT DRAWER */}
      <CreateShipmentDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        order={orderForNewShipment}
        onSuccess={() => {
          fetchShipments();
        }}
      />

      {/* MANIFEST MODAL */}
      {isManifestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[var(--gray-900)] rounded-xl max-w-md w-full p-6 space-y-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] shadow-2xl">
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Generate Courier Handover Manifest
            </h3>
            <p className="text-xs text-[var(--gray-500)]">
              Produces a printable sign-off sheet for all parcels handed to this courier today.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium block mb-1">Courier Partner *</label>
                <select
                  value={manifestCourierId}
                  onChange={(e) => setManifestCourierId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Manifest Date</label>
                <input
                  type="date"
                  value={manifestDate}
                  onChange={(e) => setManifestDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManifestModalOpen(false)}
                className="px-3 py-2 text-xs border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manifestLoading}
                onClick={handleCreateManifest}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
              >
                {manifestLoading ? "Generating..." : "Generate & Print Manifest"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
