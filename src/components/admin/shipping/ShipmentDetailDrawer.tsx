"use client";

import React, { useState, useEffect } from "react";
import Drawer from "@/components/admin/ui/Drawer";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { formatPaise } from "@/lib/money";
import { useToast } from "@/components/admin/ui/Toast";
import {
  Copy,
  ExternalLink,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  AlertTriangle,
  User,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";

interface ShipmentEvent {
  id: string;
  status: string;
  description: string;
  location?: string | null;
  eventAt: string;
  source: string;
  createdByName?: string | null;
}

interface ShipmentDetail {
  id: string;
  shipmentNumber: string;
  status: string;
  awbNumber: string | null;
  weightGrams: number;
  shippingChargePaise: number;
  codAmountPaise: number;
  estimatedCostPaise: number;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  expectedDeliveryDate: string | null;
  isStuck: boolean;
  rtoReason?: string | null;
  courier: {
    id: string;
    name: string;
    code: string;
    integrationMode: string;
  };
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPincode: string;
    totalAmount: number;
    paymentMethod: string;
  };
  lines: Array<{
    id: string;
    quantity: number;
    orderLine: {
      id: string;
      productName: string;
      sku: string;
    };
  }>;
  events: ShipmentEvent[];
}

interface ShipmentDetailDrawerProps {
  shipmentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateSecondShipment?: (order: any) => void;
  onUpdated?: () => void;
}

export default function ShipmentDetailDrawer({
  shipmentId,
  isOpen,
  onClose,
  onCreateSecondShipment,
  onUpdated,
}: ShipmentDetailDrawerProps) {
  const { addToast } = useToast();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [notInShipment, setNotInShipment] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Status update modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("IN_TRANSIT");
  const [statusReason, setStatusReason] = useState("");
  const [statusLocation, setStatusLocation] = useState("");

  // RTO modal state
  const [isRtoModalOpen, setIsRtoModalOpen] = useState(false);
  const [rtoReason, setRtoReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (shipmentId && isOpen) {
      fetchDetail();
    } else {
      setShipment(null);
    }
  }, [shipmentId, isOpen]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`);
      if (res.ok) {
        const data = await res.json();
        setShipment(data.shipment);
        setNotInShipment(data.notInThisShipment || []);
      } else {
        addToast("Failed to load shipment details", "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to load shipment details", "error");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied to clipboard!`, "success");
  }

  async function handleUpdateStatus() {
    if (!statusReason.trim()) {
      addToast("Please provide a reason for manual status update", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim(),
          location: statusLocation.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      addToast("Status updated successfully", "success");
      setIsStatusModalOpen(false);
      setStatusReason("");
      fetchDetail();
      onUpdated?.();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkRto() {
    if (!rtoReason.trim()) {
      addToast("Please provide an RTO reason", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/rto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MARK_RTO",
          reason: rtoReason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to mark RTO");
      }

      addToast("Shipment marked as RTO", "success");
      setIsRtoModalOpen(false);
      setRtoReason("");
      fetchDetail();
      onUpdated?.();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={shipment ? shipment.shipmentNumber : "Shipment Details"}
      width="wide"
    >
      {loading || !shipment ? (
        <div className="py-20 text-center text-sm text-[var(--gray-500)] animate-pulse">
          Loading shipment details...
        </div>
      ) : (
        <div className="space-y-6 pb-20 text-sm">
          {/* TOP SUMMARY BAR */}
          <div className="flex items-center justify-between bg-[var(--gray-50)] dark:bg-[var(--gray-800)] p-4 rounded-lg border border-[var(--gray-200)] dark:border-[var(--gray-700)]">
            <div>
              <span className="font-mono font-bold text-base">{shipment.shipmentNumber}</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[var(--gray-500)]">Order:</span>
                <Link
                  href={`/admin/orders/${shipment.order.id}`}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs"
                >
                  #{shipment.order.orderNumber}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <div>
              <StatusBadge status={shipment.status} />
            </div>
          </div>

          {/* META GRID */}
          <div className="grid grid-cols-2 gap-4 p-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg bg-white dark:bg-[var(--gray-900)] text-xs">
            <div>
              <span className="text-[var(--gray-500)] block">Courier</span>
              <span className="font-semibold text-sm">{shipment.courier.name}</span>
            </div>

            <div>
              <span className="text-[var(--gray-500)] block">AWB Number</span>
              {shipment.awbNumber ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-sm">{shipment.awbNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyText(shipment.awbNumber!, "AWB")}
                    className="p-1 hover:bg-[var(--gray-100)] rounded text-[var(--gray-500)]"
                    title="Copy AWB"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[var(--gray-400)] italic">Not yet assigned</span>
              )}
            </div>

            <div>
              <span className="text-[var(--gray-500)] block">Weight</span>
              <span className="font-medium">{shipment.weightGrams} g</span>
            </div>

            <div>
              <span className="text-[var(--gray-500)] block">Customer Charge</span>
              <span className="font-medium">{formatPaise(shipment.shippingChargePaise)}</span>
            </div>

            <div>
              <span className="text-[var(--gray-500)] block">COD Collection</span>
              <span className="font-medium">
                {shipment.codAmountPaise > 0 ? formatPaise(shipment.codAmountPaise) : "— (Prepaid)"}
              </span>
            </div>

            <div>
              <span className="text-[var(--gray-500)] block">Dispatched Date</span>
              <span className="font-medium">
                {shipment.dispatchedAt ? new Date(shipment.dispatchedAt).toLocaleString() : "Not dispatched"}
              </span>
            </div>
          </div>

          {/* SECTION: ITEMS IN SHIPMENT */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
              Items in this Shipment ({shipment.lines.reduce((s, l) => s + l.quantity, 0)})
            </h3>
            <div className="border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
              {shipment.lines.map((l) => (
                <div key={l.id} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-medium text-[var(--gray-900)] dark:text-gray-100">
                      {l.orderLine.productName}
                    </span>
                    <span className="block text-[var(--gray-400)] font-mono">{l.orderLine.sku}</span>
                  </div>
                  <span className="font-bold text-sm bg-[var(--gray-100)] dark:bg-[var(--gray-800)] px-2.5 py-1 rounded">
                    × {l.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* PARTIAL SHIPMENT DISCOVERY BLOCK: "Not in this shipment" */}
            {notInShipment.length > 0 && (
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg space-y-3">
                <div className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                  Not in this shipment:
                </div>
                <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                  {notInShipment.map((item) => (
                    <div key={item.orderLineId} className="flex justify-between">
                      <span>{item.productName}</span>
                      <span className="font-semibold">
                        {item.remainingUnshippedQuantity} remaining unshipped
                      </span>
                    </div>
                  ))}
                </div>
                {onCreateSecondShipment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCreateSecondShipment(shipment.order);
                    }}
                    className="mt-2 w-full py-2 px-3 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Create second shipment
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SECTION: SHIP TO */}
          <div className="p-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg space-y-2 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-[var(--gray-500)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Ship To
            </h3>
            <div className="font-semibold text-sm text-[var(--gray-900)] dark:text-gray-100">
              {shipment.order.customerName}
            </div>
            <div>{shipment.order.deliveryAddress}</div>
            <div>
              {shipment.order.deliveryCity}, {shipment.order.deliveryState} -{" "}
              <strong>{shipment.order.deliveryPincode}</strong>
            </div>
            <div className="flex items-center gap-2 pt-1 text-[var(--gray-600)] dark:text-[var(--gray-400)]">
              <span>Phone: {shipment.order.customerPhone}</span>
              <button
                type="button"
                onClick={() => copyText(shipment.order.customerPhone, "Phone")}
                className="hover:text-blue-600"
                title="Copy phone"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* SECTION: TRACKING TIMELINE */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Tracking Events
            </h3>

            <div className="border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg p-4 space-y-4">
              {shipment.events && shipment.events.length > 0 ? (
                shipment.events.map((ev, index) => {
                  const isManual = ev.source === "MANUAL";
                  return (
                    <div key={ev.id} className="relative pl-6 pb-4 border-l border-gray-300 dark:border-gray-700 last:border-0 last:pb-0">
                      <div
                        className={`absolute -left-1.5 top-0 w-3 h-3 rounded-full ${
                          index === 0
                            ? isManual
                              ? "bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950"
                              : "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950"
                            : "bg-gray-400"
                        }`}
                      />
                      <div className="flex justify-between items-start text-xs">
                        <span className="font-bold uppercase tracking-wider text-[var(--gray-800)] dark:text-gray-200">
                          {ev.status}
                        </span>
                        <span className="text-[var(--gray-400)]">
                          {new Date(ev.eventAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--gray-600)] dark:text-[var(--gray-400)] mt-0.5">
                        {ev.location && <span className="font-medium mr-2">{ev.location} —</span>}
                        {ev.description}
                      </div>
                      {isManual && (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded inline-block">
                          Set manually by {ev.createdByName || "Admin"}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-center text-[var(--gray-400)] py-4">
                  No tracking events recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* DRAWER FOOTER ACTIONS */}
          <div className="fixed bottom-0 right-0 w-[640px] p-4 bg-white dark:bg-[var(--gray-900)] border-t border-[var(--gray-200)] dark:border-[var(--gray-700)] flex justify-between gap-3 z-10">
            <div className="flex gap-2">
              <a
                href={`/api/admin/shipments/${shipment.id}/label`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 text-xs font-medium border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)] flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print label
              </a>

              {shipment.status !== "RTO" && shipment.status !== "RTO_DELIVERED" && shipment.status !== "DELIVERED" && (
                <button
                  type="button"
                  onClick={() => setIsRtoModalOpen(true)}
                  className="px-3 py-2 text-xs font-medium border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Mark RTO
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Update status
            </button>
          </div>
        </div>
      )}

      {/* MANUAL STATUS OVERRIDE MODAL */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[var(--gray-900)] rounded-xl max-w-md w-full p-6 space-y-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] shadow-2xl">
            <h3 className="text-base font-bold">Manual Status Update</h3>
            <p className="text-xs text-[var(--gray-500)]">
              This event will be logged with source MANUAL and tagged with your name.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium block mb-1">New Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
                >
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="FAILED_DELIVERY">FAILED_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Nagpur Sorting Hub"
                  value={statusLocation}
                  onChange={(e) => setStatusLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Reason / Note *</label>
                <textarea
                  rows={3}
                  placeholder="Required for manual overrides"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-3 py-2 text-xs border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
              >
                {actionLoading ? "Saving..." : "Save Override"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RTO MODAL */}
      {isRtoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[var(--gray-900)] rounded-xl max-w-md w-full p-6 space-y-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] shadow-2xl">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Mark Shipment as RTO
            </h3>
            <p className="text-xs text-[var(--gray-500)]">
              This marks the parcel as returning to origin. Delivery attempts are stopped.
            </p>

            <div>
              <label className="text-xs font-medium block mb-1">RTO Reason *</label>
              <textarea
                rows={3}
                placeholder="e.g. Customer refused delivery / Address unlocatable / Multiple failed attempts"
                value={rtoReason}
                onChange={(e) => setRtoReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRtoModalOpen(false)}
                className="px-3 py-2 text-xs border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleMarkRto}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg"
              >
                {actionLoading ? "Marking..." : "Confirm RTO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
