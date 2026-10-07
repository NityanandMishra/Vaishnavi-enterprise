"use client";

import React, { useState, useEffect } from "react";
import Drawer from "@/components/admin/ui/Drawer";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { useToast } from "@/components/admin/ui/Toast";
import { Package, Truck, AlertCircle, CheckCircle2, Clock, Info } from "lucide-react";

interface OrderLine {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  shipmentLines?: Array<{ quantity: number }>;
}

interface OrderData {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryPincode: string;
  deliveryCity: string;
  deliveryState: string;
  totalAmount: number;
  shippingCost: number;
  deliveryZone?: string;
  paymentMethod: string;
  items: OrderLine[];
}

interface CourierServiceOption {
  courierId: string;
  courierName: string;
  courierCode: string;
  integrationMode: string;
  serviceable: boolean;
  reason?: string;
  costPaise?: number;
  transitDays?: number;
  supportsCod: boolean;
}

interface CreateShipmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData | null;
  onSuccess: (shipment: any) => void;
}

export default function CreateShipmentDrawer({
  isOpen,
  onClose,
  order,
  onSuccess,
}: CreateShipmentDrawerProps) {
  const { addToast } = useToast();

  const [selectedLines, setSelectedLines] = useState<Record<string, { selected: boolean; quantity: number }>>({});
  const [weightGrams, setWeightGrams] = useState<number>(500);
  const [calculatedWeight, setCalculatedWeight] = useState<number>(500);
  const [courierOptions, setCourierOptions] = useState<CourierServiceOption[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [manualAwb, setManualAwb] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingCouriers, setFetchingCouriers] = useState<boolean>(false);

  // Initialize lines and calculate weights when order changes
  useEffect(() => {
    if (!order) return;

    const initialLines: Record<string, { selected: boolean; quantity: number }> = {};
    let totalWeight = 0;

    order.items.forEach((item) => {
      const alreadyShipped = item.shipmentLines?.reduce((sum, sl) => sum + sl.quantity, 0) || 0;
      const available = Math.max(0, item.quantity - alreadyShipped);

      if (available > 0) {
        initialLines[item.id] = { selected: true, quantity: available };
        totalWeight += available * 500; // default 500g per item
      }
    });

    setSelectedLines(initialLines);
    setCalculatedWeight(totalWeight || 500);
    setWeightGrams(totalWeight || 500);
    setManualAwb("");

    // Fetch courier serviceability for destination pincode
    fetchServiceability(order.deliveryPincode, totalWeight || 500);
  }, [order]);

  async function fetchServiceability(pincode: string, weight: number) {
    if (!pincode) return;
    setFetchingCouriers(true);
    try {
      const res = await fetch(`/api/admin/shipping/serviceability?pincode=${pincode}&weightGrams=${weight}`);
      if (res.ok) {
        const data = await res.json();
        const options: CourierServiceOption[] = data.couriers || [];
        setCourierOptions(options);

        // Auto-select first serviceable courier
        const firstServiceable = options.find((c) => c.serviceable);
        if (firstServiceable) {
          setSelectedCourierId(firstServiceable.courierId);
        }
      }
    } catch (e) {
      console.error("Failed to fetch serviceability", e);
    } finally {
      setFetchingCouriers(false);
    }
  }

  function handleLineToggle(lineId: string) {
    setSelectedLines((prev) => {
      const current = prev[lineId];
      if (!current) return prev;
      const nextSelected = !current.selected;
      const updated = {
        ...prev,
        [lineId]: { ...current, selected: nextSelected },
      };

      // Recalculate weight
      let calcWeight = 0;
      Object.keys(updated).forEach((id) => {
        if (updated[id].selected) {
          calcWeight += updated[id].quantity * 500;
        }
      });
      setCalculatedWeight(calcWeight);
      setWeightGrams(calcWeight);
      return updated;
    });
  }

  function handleQuantityChange(lineId: string, qty: number, maxQty: number) {
    const validQty = Math.max(1, Math.min(maxQty, qty));
    setSelectedLines((prev) => {
      const updated = {
        ...prev,
        [lineId]: { ...prev[lineId], quantity: validQty },
      };
      let calcWeight = 0;
      Object.keys(updated).forEach((id) => {
        if (updated[id].selected) {
          calcWeight += updated[id].quantity * 500;
        }
      });
      setCalculatedWeight(calcWeight);
      setWeightGrams(calcWeight);
      return updated;
    });
  }

  const selectedCourier = courierOptions.find((c) => c.courierId === selectedCourierId);
  const isManualCourier = selectedCourier?.integrationMode === "MANUAL";
  const isCod = order?.paymentMethod === "COD";

  // Check if any items are left unshipped
  let anyUnshipped = false;
  if (order) {
    for (const item of order.items) {
      const alreadyShipped = item.shipmentLines?.reduce((sum, sl) => sum + sl.quantity, 0) || 0;
      const avail = item.quantity - alreadyShipped;
      const willShip = selectedLines[item.id]?.selected ? selectedLines[item.id].quantity : 0;
      if (avail - willShip > 0) {
        anyUnshipped = true;
        break;
      }
    }
  }

  async function handleSubmit(dispatchImmediately: boolean) {
    if (!order) return;
    if (!selectedCourierId) {
      addToast("Please select a courier partner", "error");
      return;
    }

    if (isManualCourier && dispatchImmediately && !manualAwb.trim()) {
      addToast("AWB number is required for manual courier dispatch", "error");
      return;
    }

    const linesToShip = Object.entries(selectedLines)
      .filter(([_, state]) => state.selected && state.quantity > 0)
      .map(([orderLineId, state]) => ({
        orderLineId,
        quantity: state.quantity,
      }));

    if (linesToShip.length === 0) {
      addToast("Select at least one item to ship", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          courierId: selectedCourierId,
          lines: linesToShip,
          weightGrams,
          awbNumber: manualAwb.trim() || undefined,
          dispatchImmediately,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create shipment");
      }

      addToast(
        dispatchImmediately
          ? `Shipment ${data.shipment.shipmentNumber} created and dispatched!`
          : `Shipment ${data.shipment.shipmentNumber} created!`,
        "success"
      );
      onSuccess(data.shipment);
      onClose();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  if (!order) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Shipment · #${order.orderNumber}`}
      width="wide"
    >
      <div className="flex flex-col h-full space-y-6 pb-20">
        {/* Destination & Order summary */}
        <div className="bg-[var(--gray-50)] dark:bg-[var(--gray-800)] p-4 rounded-lg border border-[var(--gray-200)] dark:border-[var(--gray-700)] text-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-[var(--gray-900)] dark:text-white">
              {order.customerName}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              PIN: {order.deliveryPincode}
            </span>
          </div>
          <div className="text-[var(--gray-600)] dark:text-[var(--gray-400)] text-xs">
            {order.deliveryCity}, {order.deliveryState}
          </div>
        </div>

        {/* SECTION 1: ITEMS TO SHIP */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
              Items to Ship
            </h3>
            <span className="text-xs text-[var(--gray-500)]">Select items and quantities</span>
          </div>

          <div className="space-y-2 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
            {order.items.map((item) => {
              const alreadyShipped = item.shipmentLines?.reduce((s, sl) => s + sl.quantity, 0) || 0;
              const available = Math.max(0, item.quantity - alreadyShipped);
              const lineState = selectedLines[item.id] || { selected: false, quantity: available };

              if (available === 0) {
                return (
                  <div key={item.id} className="p-3 bg-[var(--gray-100)] dark:bg-[var(--gray-850)] opacity-60 flex justify-between items-center text-xs">
                    <span>{item.productName}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Already Shipped</span>
                  </div>
                );
              }

              return (
                <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      id={`line-${item.id}`}
                      checked={lineState.selected}
                      onChange={() => handleLineToggle(item.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor={`line-${item.id}`} className="truncate cursor-pointer font-medium text-[var(--gray-900)] dark:text-gray-100">
                      {item.productName}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={available}
                      disabled={!lineState.selected}
                      value={lineState.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value, 10), available)}
                      className="w-16 px-2 py-1 text-center border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded bg-white dark:bg-[var(--gray-800)] text-sm disabled:opacity-50"
                    />
                    <span className="text-xs text-[var(--gray-500)] whitespace-nowrap">
                      of {available}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {anyUnshipped && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Partial shipment:</strong> Some items are left unshipped. You can create a second shipment for them later.
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: WEIGHT */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
            Weight *
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                min={1}
                value={weightGrams}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setWeightGrams(val);
                  fetchServiceability(order.deliveryPincode, val);
                }}
                className="w-full px-3 py-2 border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg bg-white dark:bg-[var(--gray-800)] text-sm"
              />
              <span className="absolute right-3 top-2.5 text-xs text-[var(--gray-400)]">grams</span>
            </div>
          </div>
          <p className="text-xs text-[var(--gray-500)]">
            Calculated {calculatedWeight.toLocaleString()} g from item weights
          </p>
        </div>

        {/* SECTION 3: COURIER PARTNER SELECTION */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
              Courier Partner *
            </label>
            {fetchingCouriers && <span className="text-xs text-blue-600 animate-pulse">Checking pincode...</span>}
          </div>

          <div className="space-y-2 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
            {courierOptions.map((c) => {
              const isSelected = selectedCourierId === c.courierId;
              const isAvailable = c.serviceable;

              return (
                <div
                  key={c.courierId}
                  onClick={() => isAvailable && setSelectedCourierId(c.courierId)}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    !isAvailable
                      ? "opacity-50 cursor-not-allowed bg-[var(--gray-50)] dark:bg-[var(--gray-850)]"
                      : isSelected
                      ? "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-600"
                      : "hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="courier"
                      checked={isSelected}
                      disabled={!isAvailable}
                      onChange={() => setSelectedCourierId(c.courierId)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {c.courierName}
                        {c.integrationMode === "API" ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded font-semibold">
                            API
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded font-semibold">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--gray-500)] flex items-center gap-3 mt-0.5">
                        {isAvailable ? (
                          <>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              costs {c.costPaise ? formatPaise(c.costPaise) : "₹49.00"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {c.transitDays || 3} days
                            </span>
                          </>
                        ) : (
                          <span className="text-red-500">{c.reason || "Not serviceable for this pincode"}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isAvailable ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <span className="text-xs text-red-500 font-medium">Unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CRITICAL PRD RULE: Cost vs Charge Separation */}
          <div className="p-3 bg-[var(--gray-50)] dark:bg-[var(--gray-800)] border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg text-xs space-y-1">
            <div className="text-[var(--gray-500)]">
              Serviceability for <strong className="text-[var(--gray-800)] dark:text-gray-200">{order.deliveryPincode}</strong>
            </div>
            <div className="text-[var(--gray-700)] dark:text-gray-300">
              Customer was charged <strong>₹{order.shippingCost.toFixed(2)}</strong> ({order.deliveryZone || "Rest of India zone"}) —{" "}
              <span className="text-[var(--gray-500)] italic">fixed at placement</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: MANUAL AWB ENTRY (If Manual Mode selected) */}
        {isManualCourier && (
          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
              AWB Number * (Manual Courier)
            </label>
            <input
              type="text"
              placeholder="e.g. IPO123456789IN"
              value={manualAwb}
              onChange={(e) => setManualAwb(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg font-mono text-sm bg-white dark:bg-[var(--gray-800)]"
            />
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              Manual couriers require an AWB entered before or during dispatch.
            </p>
          </div>
        )}

        {/* SECTION 5: COD NOTICE */}
        <div className="p-3 rounded-lg border border-[var(--gray-200)] dark:border-[var(--gray-700)] bg-[var(--gray-50)] dark:bg-[var(--gray-800)] text-xs flex justify-between items-center">
          <span className="text-[var(--gray-600)] dark:text-[var(--gray-400)]">COD Amount</span>
          <span className="font-bold text-sm">
            {isCod ? `₹${order.totalAmount.toFixed(2)} (Cash on Delivery)` : "₹0.00 (Order is prepaid)"}
          </span>
        </div>

        {/* DRAWER FOOTER ACTIONS */}
        <div className="fixed bottom-0 right-0 w-[640px] p-4 bg-white dark:bg-[var(--gray-900)] border-t border-[var(--gray-200)] dark:border-[var(--gray-700)] flex justify-end gap-3 z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-[var(--gray-300)] dark:border-[var(--gray-600)] rounded-lg hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)]"
          >
            Cancel
          </button>

          {!isManualCourier ? (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading || !selectedCourierId}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Processing..." : "Create & Dispatch"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading || !selectedCourierId}
                className="px-4 py-2 text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
              >
                Create Shipment
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading || !selectedCourierId || !manualAwb.trim()}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Create & Dispatch
              </button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
