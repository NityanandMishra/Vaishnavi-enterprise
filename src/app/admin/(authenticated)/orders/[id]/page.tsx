"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  MoreHorizontal,
  Phone,
  Mail,
  Copy,
  Check,
  MapPin,
  Lock,
  Eye,
  AlertTriangle,
  Clock,
  Truck,
  ExternalLink,
  Package,
  Calendar,
  Send,
  Loader2,
  X,
  FileText,
  CreditCard,
  User,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import CancelOrderModal from "@/components/admin/orders/CancelOrderModal";
import EditAddressDrawer from "@/components/admin/orders/EditAddressDrawer";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(
    searchParams.get("action") === "shipment"
  );

  // Line cancellation modal
  const [cancellingLine, setCancellingLine] = useState<any>(null);
  const [cancelLineReason, setCancelLineReason] = useState("Out of stock");
  const [cancellingLineLoading, setCancellingLineLoading] = useState(false);

  // Shipment form
  const [courier, setCourier] = useState("Delhivery");
  const [awb, setAwb] = useState("");
  const [dispatchingLoading, setDispatchingLoading] = useState(false);

  // Notes state
  const [activeNoteTab, setActiveNoteTab] = useState<"INTERNAL" | "CUSTOMER">("INTERNAL");
  const [noteBody, setNoteBody] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Revert reason modal
  const [revertingTo, setRevertingTo] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertLoading, setRevertLoading] = useState(false);

  // Copied feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order not found");
      setOrder(data.order);
      if (data.order.status === "PACKED" && searchParams.get("action") === "shipment") {
        setIsShipmentModalOpen(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Primary Status Action Handler (S2)
  const handlePrimaryAction = async () => {
    if (!order) return;

    if (order.status === "PACKED") {
      setIsShipmentModalOpen(true);
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to advance order status");
      }
      fetchOrder();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Revert status with mandatory reason (ORD-03)
  const handleConfirmRevert = async () => {
    if (!revertingTo || !revertReason.trim()) return;
    setRevertLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: revertingTo,
          reason: revertReason.trim(),
          actor: "Admin",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to revert order status");
      }
      setRevertingTo(null);
      setRevertReason("");
      fetchOrder();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRevertLoading(false);
    }
  };

  // Dispatch shipment (Module 07 integration, consumes stock via INV-04)
  const handleDispatchShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchingLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: courier,
          awb: awb.trim() || `AWB-${Date.now()}`,
          trackingUrl: `https://track.courier.com/${awb.trim() || "123"}`,
          actor: "Admin",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to dispatch shipment");
      }
      setIsShipmentModalOpen(false);
      fetchOrder();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDispatchingLoading(false);
    }
  };

  // Line cancellation handler (ORD-05)
  const handleConfirmCancelLine = async () => {
    if (!cancellingLine) return;
    setCancellingLineLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/lines/${cancellingLine.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelLineReason,
          actor: "Admin",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to cancel line");
      }
      setCancellingLine(null);
      fetchOrder();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingLineLoading(false);
    }
  };

  // Add note (ORD-08)
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteBody.trim(),
          isCustomerVisible: activeNoteTab === "CUSTOMER",
          actor: "Admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      fetchOrder();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-xs text-slate-500 font-medium">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <AlertTriangle size={32} className="text-rose-500 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-rose-900">Order Not Found</h2>
          <p className="text-xs text-rose-700 mt-1">{error || "Could not find requested order."}</p>
          <button
            onClick={() => router.push("/admin/orders")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft size={14} />
            <span>Back to Orders</span>
          </button>
        </div>
      </div>
    );
  }

  const shipping = order.parsedShipping || {};
  const isPreDispatch = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.status);
  const isShippedOrDelivered = order.status === "SHIPPED" || order.status === "DELIVERED";
  const isInterState = order.deliveryStateCode !== "27"; // House seller state: 27 Maharashtra

  // Formatted courier-ready address text for copy (ORD-07 AC 8)
  const courierFormattedAddress = `${shipping.fullName || order.customerName}\n${shipping.addressLine1}${
    shipping.addressLine2 ? `, ${shipping.addressLine2}` : ""
  }\n${shipping.city}, ${shipping.state} ${shipping.pincode}\nPhone: ${shipping.phone || order.customerPhone}`;

  // Totals calculations (ORD-02 AC 2)
  const activeLines = (order.items || []).filter((i: any) => i.status !== "CANCELLED");
  const cancelledLines = (order.items || []).filter((i: any) => i.status === "CANCELLED");
  const subtotal = (order.items || []).reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const lineCancellationsTotal = cancelledLines.reduce(
    (s: number, i: any) => s + i.price * i.quantity,
    0
  );

  const internalNotes = (order.notes || []).filter((n: any) => !n.isCustomerVisible);
  const customerNotes = (order.notes || []).filter((n: any) => n.isCustomerVisible);

  return (
    <div className="font-sans space-y-6 pb-24">
      {/* STICKY HEADER (S2 Specification) */}
      <div className="sticky top-0 z-20 -mx-4 -mt-6 sm:-mx-6 sm:-mt-6 px-4 py-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/orders"
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                <ArrowLeft size={13} />
                <span>Orders</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {order.orderNumber || `#${order.id.slice(0, 8)}`}
              </span>
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-mono">
                {order.orderNumber || `#${order.id.slice(0, 8)}`}
              </h1>

              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase border ${
                  order.status === "CONFIRMED"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : order.status === "PROCESSING"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : order.status === "PACKED"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : order.status === "SHIPPED"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : order.status === "DELIVERED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : order.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {order.status}
              </span>

              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                {order.paymentStatus} · {order.paymentMethod}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>
                Placed: {new Date(order.placedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
              {order.slaText && (
                <span
                  className={`font-mono font-medium ${
                    order.isSlaBreached ? "text-rose-600 font-bold" : "text-slate-400"
                  }`}
                >
                  · ⏱ {order.slaText}
                </span>
              )}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/orders/${order.id}/pick-list`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Printer size={14} />
              <span>Print pick list</span>
            </Link>

            {/* Overflow / More Actions */}
            <div className="relative group">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                <MoreHorizontal size={16} />
              </button>

              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs space-y-0.5">
                {/* Backward transition options (ORD-03) */}
                {order.status === "PACKED" && (
                  <button
                    onClick={() => setRevertingTo("PROCESSING")}
                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Revert to Processing
                  </button>
                )}
                {order.status === "PROCESSING" && (
                  <button
                    onClick={() => setRevertingTo("CONFIRMED")}
                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Revert to Confirmed
                  </button>
                )}

                {/* Pre-dispatch cancel option */}
                {isPreDispatch && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-rose-50 text-rose-600 font-medium"
                  >
                    Cancel order
                  </button>
                )}

                {/* Pre-dispatch edit address */}
                {isPreDispatch && (
                  <button
                    onClick={() => setIsEditAddressOpen(true)}
                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Edit address
                  </button>
                )}

                <Link
                  href={`/admin/orders/${order.id}/invoice`}
                  className="block px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 font-medium"
                >
                  Download invoice
                </Link>

                <button
                  onClick={() => copyToClipboard(window.location.href, "link")}
                  className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 font-medium"
                >
                  {copiedField === "link" ? "Copied!" : "Copy order link"}
                </button>
              </div>
            </div>

            {/* Primary Action Button (S2) */}
            {order.primaryAction && (
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors"
              >
                <span>{order.primaryAction}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT (≥1280px 2-col; stacked below - S2) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* MAIN COLUMN (8 Cols on xl) */}
        <div className="xl:col-span-8 space-y-6">
          {/* SECTION 1: ITEMS (Snapshot Integrity — FI-01) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 mb-4">
              Items Ordered
            </h2>

            <div className="divide-y divide-slate-100">
              {order.items.map((item: any) => {
                const isCancelled = item.status === "CANCELLED";
                const lineTotal = item.lineTotal || item.price * item.quantity;

                return (
                  <div
                    key={item.id}
                    className={`py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-opacity ${
                      isCancelled ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <div className="flex-1">
                      {/* Product Name with Rename Tooltip (ORD-02 AC 1) */}
                      <div className="relative group inline-block">
                        <span className="font-semibold text-sm text-slate-900">
                          {item.displayName}
                        </span>
                        {item.renameTooltip && (
                          <span className="ml-2 inline-block rounded bg-amber-100 text-amber-900 px-1.5 py-0.2 text-[10px] font-normal no-underline">
                            {item.renameTooltip}
                          </span>
                        )}
                      </div>

                      {item.variantTitle && (
                        <div className="text-xs text-slate-500 mt-0.5">{item.variantTitle}</div>
                      )}

                      <div className="font-mono text-[11px] text-slate-400 mt-0.5 space-x-2">
                        <span>{item.sku}</span>
                        <span>·</span>
                        <span>HSN {item.hsnCode || "—"}</span>
                        <span>·</span>
                        <span>GST {item.gstRate || 18}%</span>
                      </div>

                      {isCancelled && item.adjustments?.[0] && (
                        <div className="mt-1 text-xs text-rose-700 font-medium not-line-through">
                          Cancelled by {item.adjustments[0].createdBy || "Staff"} · "
                          {item.adjustments[0].reason}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-right font-mono">
                      <div className="text-xs text-slate-600">
                        {formatINR(item.price)} × {item.quantity}
                      </div>

                      <div className="font-bold text-sm text-slate-900 min-w-[90px]">
                        {formatINR(lineTotal)}
                      </div>

                      {/* Per-line cancel button (pre-dispatch only - ORD-05) */}
                      {!isCancelled && isPreDispatch && (
                        <button
                          type="button"
                          onClick={() => setCancellingLine(item)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TOTALS BLOCK (Right-aligned, tabular, mono - S2) */}
            <div className="border-t-2 border-slate-900 mt-6 pt-4 flex justify-end">
              <div className="w-full sm:w-80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 font-sans">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatINR(subtotal)}</span>
                </div>

                {lineCancellationsTotal > 0 && (
                  <div className="flex justify-between text-rose-600 font-sans">
                    <span>Line cancellations:</span>
                    <span className="font-mono">− {formatINR(lineCancellationsTotal)}</span>
                  </div>
                )}

                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-sans">
                    <span>Discount:</span>
                    <span className="font-mono">− {formatINR(order.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 font-sans border-t border-slate-100 pt-1.5">
                  <span>Taxable value:</span>
                  <span className="font-mono font-medium">{formatINR(order.taxableAmount || order.totalAmount * 0.82)}</span>
                </div>

                {/* Tax split: IGST if inter-state, CGST+SGST if intra-state (ORD-02 AC 3) */}
                {isInterState ? (
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>IGST:</span>
                    <span className="font-mono">{formatINR(order.taxAmount || order.igstAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>CGST:</span>
                      <span className="font-mono">{formatINR((order.taxAmount || 0) / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>SGST:</span>
                      <span className="font-mono">{formatINR((order.taxAmount || 0) / 2)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-slate-600 font-sans">
                  <span>Shipping:</span>
                  <span className="font-mono">{formatINR(order.shippingCost)}</span>
                </div>

                <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-sm font-bold text-slate-900 font-sans">
                  <span>Total:</span>
                  <span className="font-mono">{formatINR(order.totalAmount)}</span>
                </div>

                <div className="flex justify-between text-slate-600 font-sans">
                  <span>Paid:</span>
                  <span className="font-mono">{formatINR(order.paidAmount || 0)}</span>
                </div>

                {/* Outstanding balance in danger color (ORD-02 AC 6) */}
                <div
                  className={`flex justify-between font-sans pt-1 font-bold ${
                    order.balanceAmount > 0 ? "text-rose-600 text-sm" : "text-slate-500"
                  }`}
                >
                  <span>Balance:</span>
                  <span className="font-mono">{formatINR(order.balanceAmount || 0)}</span>
                </div>

                {order.refundDueAmount > 0 && (
                  <div className="flex justify-between text-rose-700 font-sans pt-1 font-bold">
                    <span>Refund Due:</span>
                    <span className="font-mono">{formatINR(order.refundDueAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: SHIPMENTS (Module 07 / SHIP-05) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 mb-4">
              Shipments & Logistics
            </h2>

            {order.trackingNumber ? (
              <div className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-bold">
                      {order.status === "DELIVERED" ? "Delivered" : "In Transit"}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      Delhivery · AWB {order.trackingNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Dispatched {order.shippedAt ? new Date(order.shippedAt).toLocaleDateString("en-IN") : "Recently"}
                  </p>
                </div>

                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Track</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                <Truck size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700">Not shipped yet.</p>
                {order.status === "PACKED" && (
                  <button
                    type="button"
                    onClick={() => setIsShipmentModalOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs"
                  >
                    Create shipment
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: NOTES (ORD-08 — Distinct Internal vs Customer-Visible) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Notes
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNoteTab("INTERNAL")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeNoteTab === "INTERNAL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Lock size={12} />
                  <span>Internal ({internalNotes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNoteTab("CUSTOMER")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeNoteTab === "CUSTOMER"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Eye size={12} />
                  <span>Customer-visible ({customerNotes.length})</span>
                </button>
              </div>
            </div>

            {/* Note Compose Area */}
            <form onSubmit={handleAddNote} className="mb-6">
              <div
                className={`rounded-xl p-3 border ${
                  activeNoteTab === "INTERNAL"
                    ? "bg-slate-50 border-slate-300"
                    : "bg-amber-50/50 border-amber-300 ring-2 ring-amber-200"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-bold mb-2">
                  {activeNoteTab === "INTERNAL" ? (
                    <>
                      <Lock size={12} className="text-slate-500" />
                      <span className="text-slate-600">Only your team can see this</span>
                    </>
                  ) : (
                    <>
                      <Eye size={12} className="text-amber-800" />
                      <span className="text-amber-900">The customer can see this</span>
                    </>
                  )}
                </div>

                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={
                    activeNoteTab === "INTERNAL"
                      ? "Add internal operational note (immutable)..."
                      : "Add note visible to the customer on order tracking..."
                  }
                  rows={2}
                  className="w-full bg-white rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-hidden"
                />

                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={addingNote || !noteBody.trim()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Add note
                  </button>
                </div>
              </div>
            </form>

            {/* Notes List */}
            <div className="space-y-2.5">
              {(activeNoteTab === "INTERNAL" ? internalNotes : customerNotes).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No notes recorded under this tab.</p>
              ) : (
                (activeNoteTab === "INTERNAL" ? internalNotes : customerNotes).map((n: any) => (
                  <div
                    key={n.id}
                    className={`rounded-lg p-3 text-xs border ${
                      n.isCustomerVisible
                        ? "bg-amber-50/40 border-amber-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                      <span className="font-bold text-slate-700">{n.createdBy || "Staff"}</span>
                      <span>
                        {new Date(n.createdAt).toLocaleDateString("en-IN")} ·{" "}
                        {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 4: TIMELINE (ORD-09 — Chronological Audit Trail) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 mb-4">
              Order Timeline
            </h2>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {(order.statusHistory || []).map((entry: any) => (
                <div key={entry.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-slate-900 ring-4 ring-white" />

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <span className="font-bold text-xs text-slate-900 capitalize">
                      {entry.reason || `Moved to ${entry.toStatus}`}
                    </span>
                    <span
                      title={new Date(entry.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      className="text-[11px] text-slate-400 cursor-help"
                    >
                      {entry.createdBy || "System"} ·{" "}
                      {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {entry.note && (
                    <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-md border border-slate-100">
                      {entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIDE COLUMN (Sticky, 340px on xl - S2 Specification) */}
        <div className="xl:col-span-4 space-y-5 xl:sticky xl:top-24">
          {/* CUSTOMER CONTEXT BLOCK (ORD-02 AC 4) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User size={13} />
              <span>Customer</span>
            </h3>

            <div>
              <div className="font-bold text-sm text-slate-900">
                {order.customerName || order.user?.name || "Guest Customer"}
              </div>

              {/* Phone with Call & Copy */}
              <div className="flex items-center justify-between text-xs mt-1.5">
                <span className="font-mono text-slate-700">{order.customerPhone || "—"}</span>
                {order.customerPhone && (
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Phone size={13} />
                    </a>
                    <button
                      onClick={() => copyToClipboard(order.customerPhone, "phone")}
                      className="rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Email with Mail & Copy */}
              {order.customerEmail && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-600 truncate max-w-[200px]">{order.customerEmail}</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Mail size={13} />
                    </a>
                    <button
                      onClick={() => copyToClipboard(order.customerEmail, "email")}
                      className="rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lifetime order stats (S2) */}
            <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-1">
              <p>
                <strong>{order.customerStats?.orderCount || 1} orders</strong> ·{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatINR(order.customerStats?.lifetimeValue || order.totalAmount)} lifetime
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                Customer since {new Date(order.customerStats?.firstOrderDate || order.placedAt).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          {/* SHIPPING ADDRESS BLOCK (ORD-07) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin size={13} />
                <span>Shipping Address</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(courierFormattedAddress, "address")}
                  title="Copy courier-formatted address"
                  className="text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center gap-1"
                >
                  <Copy size={12} />
                  <span>{copiedField === "address" ? "Copied!" : "Copy"}</span>
                </button>

                {isPreDispatch && (
                  <button
                    onClick={() => setIsEditAddressOpen(true)}
                    className="text-xs font-bold text-slate-900 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed">
              <p className="font-semibold text-slate-900">{shipping.fullName || order.customerName}</p>
              <p>{shipping.addressLine1}</p>
              {shipping.addressLine2 && <p>{shipping.addressLine2}</p>}
              {shipping.landmark && <p className="text-slate-500">Landmark: {shipping.landmark}</p>}
              <p className="font-medium text-slate-900">
                {shipping.city}, {shipping.state} {shipping.pincode}
              </p>
              <p className="font-mono text-slate-600 mt-1">{shipping.phone || order.customerPhone}</p>
            </div>

            {/* State Tax Indicator */}
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
              {isInterState ? "⚠️ Inter-state · IGST applies" : "Intra-state · CGST + SGST applies"}
            </div>
          </div>

          {/* PAYMENT BLOCK */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2.5 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CreditCard size={13} />
              <span>Payment</span>
            </h3>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-slate-900 capitalize">{order.paymentStatus}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Method:</span>
              <span className="font-semibold text-slate-900">{order.paymentMethod}</span>
            </div>

            {order.razorpayPaymentId && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Txn:</span>
                <span className="font-mono text-slate-700">{order.razorpayPaymentId}</span>
              </div>
            )}
          </div>

          {/* SUMMARY BLOCK */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Summary
            </h3>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Source:</span>
              <span className="font-semibold text-slate-900 capitalize">{order.source || "Website"}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Active Items:</span>
              <span className="font-mono font-semibold text-slate-900">
                {activeLines.length} {cancelledLines.length > 0 ? `(${cancelledLines.length} cancelled)` : ""}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Est. Weight:</span>
              <span className="font-mono text-slate-700">1.35 kg</span>
            </div>

            <div className="flex justify-between py-1 items-center">
              <span className="text-slate-500">Invoice:</span>
              {order.invoice ? (
                <Link
                  href={`/admin/orders/${order.id}/invoice`}
                  className="font-mono font-bold text-sky-600 hover:underline"
                >
                  {order.invoice.invoiceNumber}
                </Link>
              ) : (
                <span className="text-slate-400">Not generated yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* S3 CANCEL ORDER MODAL */}
      <CancelOrderModal
        order={order}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          setIsCancelModalOpen(false);
          fetchOrder();
        }}
      />

      {/* S5 EDIT ADDRESS DRAWER */}
      <EditAddressDrawer
        orderId={order.id}
        orderNumber={order.orderNumber}
        currentAddress={shipping}
        sellerStateCode="27"
        currentShippingCost={order.shippingCost || 0}
        currentTotal={order.totalAmount || 0}
        taxAmount={order.taxAmount || 0}
        isOpen={isEditAddressOpen}
        onClose={() => setIsEditAddressOpen(false)}
        onSuccess={() => {
          setIsEditAddressOpen(false);
          fetchOrder();
        }}
      />

      {/* CREATE SHIPMENT MODAL (PACKED -> SHIPPED Dispatch Action) */}
      {isShipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Create & Dispatch Shipment</h3>
              <button
                onClick={() => setIsShipmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchShipment} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Dispatching this shipment will automatically transition the order to{" "}
                <strong className="text-slate-900">SHIPPED</strong>, consume reserved stock via INV-04,
                and generate the official GST invoice.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Courier Partner</label>
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden"
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="Blue Dart">Blue Dart</option>
                  <option value="India Post">India Post</option>
                  <option value="Shadowfax">Shadowfax</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">AWB / Tracking Number</label>
                <input
                  type="text"
                  required
                  value={awb}
                  onChange={(e) => setAwb(e.target.value)}
                  placeholder="e.g. 1234567890123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsShipmentModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchingLoading || !awb.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {dispatchingLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Dispatch & Ship</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINE CANCELLATION MODAL (ORD-05) */}
      {cancellingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Cancel Item: {cancellingLine.displayName}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This will release stock for this line and reduce the order total via an adjustment record.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cancellation Reason *</label>
                <select
                  value={cancelLineReason}
                  onChange={(e) => setCancelLineReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="Out of stock">Out of stock</option>
                  <option value="Customer request">Customer request</option>
                  <option value="Damaged item">Damaged item</option>
                  <option value="Pricing error">Pricing error</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancellingLine(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
                >
                  Keep item
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelLine}
                  disabled={cancellingLineLoading}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {cancellingLineLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Cancel Line</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVERT REASON MODAL (ORD-03) */}
      {revertingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Revert status to {revertingTo}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Backward transitions require an explanatory reason for audit logging.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="e.g. Needs repacking, Customer changed address..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevertingTo(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  disabled={revertLoading || !revertReason.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {revertLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Confirm Revert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
