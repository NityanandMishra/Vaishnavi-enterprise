"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  Truck,
  Download,
  Printer,
  ChevronRight,
  MoreHorizontal,
  Loader2,
  X,
  Calendar,
  Layers,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import CancelOrderModal from "@/components/admin/orders/CancelOrderModal";

interface OrderItem {
  id: string;
  sku: string | null;
  productName: string | null;
  variantTitle: string | null;
  quantity: number;
  cancelledQty?: number;
  price: number;
}

interface OrderRow {
  id: string;
  orderNumber: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryStateCode: string | null;
  deliveryZone: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  totalAmount: number;
  paidAmount: number;
  placedAt: string;
  slaDueAt: string | null;
  isSlaBreached: boolean;
  slaText: string;
  nextActionLabel: string;
  itemCount: number;
  items: OrderItem[];
  shippingAddress: string;
}

export default function OrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const view = searchParams.get("view") || "needs_action";
  const activeTab = searchParams.get("status") || "ALL";
  const initialSearch = searchParams.get("search") || "";
  const initialSlaOnly = searchParams.get("slaBreached") === "true";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState({ needsAction: 0, slaBreached: 0, totalAll: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [slaFilterOnly, setSlaFilterOnly] = useState(initialSlaOnly);
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  // Selection & Bulk Actions (ORD-14)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    transitioned: string[];
    skipped: { orderNumber: string; reason: string }[];
  } | null>(null);

  // Cancellation Modal state (S3)
  const [cancellingOrder, setCancellingOrder] = useState<OrderRow | null>(null);

  // Hover item popover
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("view", view);
      if (activeTab !== "ALL") params.set("status", activeTab);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (slaFilterOnly) params.set("slaBreached", "true");
      if (paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
      if (methodFilter !== "ALL") params.set("paymentMethod", methodFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
        setCounts(data.counts || { needsAction: 0, slaBreached: 0, totalAll: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [view, activeTab, searchQuery, slaFilterOnly, paymentFilter, methodFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrlParam("search", searchQuery || null);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const updateUrlParam = (key: string, val: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set(key, val);
    } else {
      params.delete(key);
    }
    router.replace(`/admin/orders?${params.toString()}`);
  };

  const handleToggleView = (newView: "needs_action" | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    params.delete("status"); // reset status tab on view toggle
    params.delete("slaBreached");
    setSlaFilterOnly(false);
    router.replace(`/admin/orders?${params.toString()}`);
  };

  const handleSelectTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "ALL") {
      params.delete("status");
    } else {
      params.set("status", tab);
    }
    router.replace(`/admin/orders?${params.toString()}`);
  };

  // Quick Action on row (ORD-01 AC 3 & ORD-03)
  const handleNextAction = async (e: React.MouseEvent, order: OrderRow) => {
    e.stopPropagation();

    if (order.status === "PACKED") {
      // Directs to Order Detail to create shipment (ORD-03 AC 2)
      router.push(`/admin/orders/${order.id}?action=shipment`);
      return;
    }

    let nextStatus = "";
    if (order.status === "PENDING") nextStatus = "CONFIRMED";
    else if (order.status === "CONFIRMED") nextStatus = "PROCESSING";
    else if (order.status === "PROCESSING") nextStatus = "PACKED";

    if (!nextStatus) return;

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: nextStatus, actor: "Admin" }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.message || "Failed to update order status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk status transition (ORD-14)
  const handleBulkTransition = async (toStatus: string) => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    setBulkResult(null);

    try {
      const res = await fetch("/api/admin/orders/bulk/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          toStatus,
          actor: "Admin",
        }),
      });

      const data = await res.json();
      setBulkResult({
        transitioned: data.transitioned || [],
        skipped: data.skipped || [],
      });
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || "Bulk transition failed");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Checkbox selection
  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((i) => i !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "CONFIRMED":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "PROCESSING":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "PACKED":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "SHIPPED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "PARTIALLY_PAID":
        return "text-amber-700 bg-amber-50 border-amber-200";
      case "REFUND_DUE":
        return "text-rose-700 bg-rose-50 border-rose-200";
      default:
        return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const formatRelativeTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <div className="font-sans space-y-5 pb-16">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          {/* Subtitle is the operational triage working figure (S1 Specification) */}
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-900">{counts.needsAction} need action</span>
            {" · "}
            <span className={counts.slaBreached > 0 ? "font-semibold text-rose-600" : ""}>
              {counts.slaBreached} breaching SLA
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/api/admin/orders/export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download size={14} />
            <span>Export</span>
          </Link>

          <Link
            href="/admin/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <Plus size={15} />
            <span>Create Order</span>
          </Link>
        </div>
      </div>

      {/* VIEW TOGGLE (The most important control on the screen - S1) */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => handleToggleView("needs_action")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              view === "needs_action"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                view === "needs_action" ? "bg-amber-500" : "bg-slate-300"
              }`}
            />
            <span>Needs action ({counts.needsAction})</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleView("all")}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              view === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                view === "all" ? "bg-slate-900" : "bg-slate-300"
              }`}
            />
            <span>All orders ({counts.totalAll})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          {view === "needs_action" ? "Sorted FIFO (Oldest first)" : "Sorted Newest first"}
        </div>
      </div>

      {/* SLA ALERT STRIP (Conditional, danger color - S1) */}
      {counts.slaBreached > 0 && !slaFilterOnly && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>
              <strong>{counts.slaBreached} orders</strong> have exceeded their handling time.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSlaFilterOnly(true);
              updateUrlParam("slaBreached", "true");
            }}
            className="font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1"
          >
            Show only these →
          </button>
        </div>
      )}

      {/* STATUS TABS */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleSelectTab("ALL")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "ALL" && !slaFilterOnly
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All {view === "needs_action" ? counts.needsAction : counts.totalAll}
        </button>

        {view === "needs_action" ? (
          <>
            {["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setSlaFilterOnly(false);
                  handleSelectTab(st);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
                  activeTab === st && !slaFilterOnly
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </>
        ) : (
          <>
            {["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setSlaFilterOnly(false);
                    handleSelectTab(st);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
                    activeTab === st && !slaFilterOnly
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              )
            )}
          </>
        )}

        {slaFilterOnly && (
          <div className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 rounded-lg px-3 py-1.5 text-xs font-bold">
            <span>Breaching SLA</span>
            <button
              onClick={() => {
                setSlaFilterOnly(false);
                updateUrlParam("slaBreached", null);
              }}
              className="hover:text-rose-950"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order no, name, phone, email, or SKU..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-2xs focus:border-slate-800 focus:outline-hidden"
          >
            <option value="ALL">Payment: All</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PENDING">Pending</option>
            <option value="REFUND_DUE">Refund Due</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-2xs focus:border-slate-800 focus:outline-hidden"
          >
            <option value="ALL">Method: All</option>
            <option value="COD">COD</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
      </div>

      {/* BULK ACTIONS BAR (ORD-14) */}
      {selectedOrderIds.length > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 p-3 text-xs text-white shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="font-bold">{selectedOrderIds.length} selected</span>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={bulkActionLoading}
              onClick={() => handleBulkTransition("CONFIRMED")}
              className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Mark Confirmed
            </button>
            <button
              disabled={bulkActionLoading}
              onClick={() => handleBulkTransition("PROCESSING")}
              className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Mark Processing
            </button>
            <button
              disabled={bulkActionLoading}
              onClick={() => handleBulkTransition("PACKED")}
              className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Mark Packed
            </button>

            <Link
              href={`/api/admin/orders/export?ids=${selectedOrderIds.join(",")}`}
              className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-700"
            >
              Export
            </Link>
          </div>
        </div>
      )}

      {/* BULK RESULT ALERT */}
      {bulkResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">
              Bulk update: {bulkResult.transitioned.length} transitioned successfully.
            </span>
            <button onClick={() => setBulkResult(null)} className="text-slate-400">
              <X size={14} />
            </button>
          </div>
          {bulkResult.skipped.length > 0 && (
            <div className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <p className="font-semibold mb-1">{bulkResult.skipped.length} orders skipped (illegal transition):</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {bulkResult.skipped.map((s, idx) => (
                  <li key={idx}>
                    <strong>{s.orderNumber}</strong>: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* TABLE / MOBILE CARDS */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Loader2 className="animate-spin text-slate-400 mx-auto" size={28} />
          <p className="text-xs text-slate-500 mt-2">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          {view === "needs_action" ? (
            <div>
              <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">
                Nothing needs action. All orders are moving.
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                There are no pending, confirmed, processing, or packed orders awaiting action.
              </p>
              <button
                onClick={() => handleToggleView("all")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                View all orders
              </button>
            </div>
          ) : (
            <div>
              <Package size={36} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">No orders yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Orders placed on your store will appear here.
              </p>
              <Link
                href="/admin/orders/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                + Create Order
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE (≥768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length === orders.length && orders.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-slate-900"
                    />
                  </th>
                  <th className="py-3 px-3">Order</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">SLA</th>
                  <th className="py-3 px-3">Deliver To</th>
                  <th className="py-3 px-3 text-right sticky right-0 bg-slate-50">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  let city = "—";
                  let state = order.deliveryStateCode || "—";
                  try {
                    const parsed = JSON.parse(order.shippingAddress);
                    city = parsed.city || city;
                    state = parsed.state || state;
                  } catch {}

                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className={`group cursor-pointer transition-colors hover:bg-slate-50/80 ${
                        order.isSlaBreached ? "border-l-4 border-l-rose-500 bg-rose-50/20" : ""
                      } ${isSelected ? "bg-slate-50" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(e as any, order.id)}
                          className="rounded border-slate-300 text-slate-900"
                        />
                      </td>

                      {/* Order */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-semibold text-slate-900 block group-hover:text-sky-600">
                          {order.orderNumber || `#${order.id.slice(0, 8)}`}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(order.placedAt)}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {order.customerName || "Guest"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {order.customerPhone || "—"}
                        </div>
                      </td>

                      {/* Items Hover Popover */}
                      <td
                        className="py-3.5 px-3 relative"
                        onMouseEnter={() => setHoveredOrderId(order.id)}
                        onMouseLeave={() => setHoveredOrderId(null)}
                      >
                        <span className="underline decoration-dotted cursor-help text-slate-700 font-medium">
                          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                        </span>

                        {hoveredOrderId === order.id && order.items && order.items.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs space-y-1.5 animate-in fade-in duration-100">
                            <span className="font-bold text-slate-700 block mb-1">Order Items:</span>
                            {order.items.map((i, idx) => (
                              <div key={idx} className="flex justify-between border-b border-slate-100 pb-1 text-[11px]">
                                <span className="truncate pr-2 text-slate-700">
                                  {i.productName || "Item"}
                                </span>
                                <span className="font-mono text-slate-900 shrink-0">×{i.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                        {formatINR(order.totalAmount)}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${getPaymentBadge(
                              order.paymentStatus
                            )}`}
                          >
                            {order.paymentStatus}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {order.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* SLA */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {order.slaText ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              order.isSlaBreached
                                ? "text-rose-600 font-bold"
                                : "text-slate-400"
                            }`}
                          >
                            {order.isSlaBreached && <AlertTriangle size={12} />}
                            <span>{order.slaText}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Deliver To */}
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {city}, {state}
                      </td>

                      {/* Action Menu / Contextual Next Button (S1) */}
                      <td className="py-3.5 px-3 text-right sticky right-0 bg-white group-hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.nextActionLabel && (
                            <button
                              type="button"
                              onClick={(e) => handleNextAction(e, order)}
                              className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-800 transition-colors whitespace-nowrap"
                            >
                              {order.nextActionLabel}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/orders/${order.id}`);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-600"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS (<768px - S1 Mobile Specification) */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className={`rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5 ${
                    order.isSlaBreached ? "border-l-4 border-l-rose-500 bg-rose-50/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">
                      {order.orderNumber || `#${order.id.slice(0, 8)}`}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {formatRelativeTime(order.placedAt)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">{order.customerName}</div>
                    <div className="font-mono text-slate-400 text-[11px]">{order.customerPhone}</div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500">{order.itemCount} items</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatINR(order.totalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {order.paymentStatus} · {order.paymentMethod}
                      </span>
                    </div>

                    {order.slaText && (
                      <span
                        className={`font-mono text-[10px] ${
                          order.isSlaBreached ? "text-rose-600 font-bold" : "text-slate-400"
                        }`}
                      >
                        ⏱ {order.slaText}
                      </span>
                    )}
                  </div>

                  {/* Contextual Full-Width Next Action Button (S1 Mobile) */}
                  {order.nextActionLabel && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => handleNextAction(e, order)}
                        className="w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors"
                      >
                        {order.nextActionLabel}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* S3 Cancellation Modal */}
      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          isOpen={true}
          onClose={() => setCancellingOrder(null)}
          onSuccess={() => {
            setCancellingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
