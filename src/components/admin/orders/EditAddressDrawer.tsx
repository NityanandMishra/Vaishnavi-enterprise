"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { INDIAN_STATES, getStateCodeByName } from "@/lib/tax/indian-states";
import { resolveShippingRate, ServiceabilityResult } from "@/lib/orders/shipping-resolver";

interface EditAddressDrawerProps {
  orderId: string;
  orderNumber?: string | null;
  currentAddress: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string | null;
    landmark?: string | null;
    pincode?: string;
    city?: string;
    state?: string;
  };
  sellerStateCode?: string;
  currentShippingCost?: number;
  currentTotal?: number;
  taxAmount?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedData: any) => void;
}

export default function EditAddressDrawer({
  orderId,
  orderNumber,
  currentAddress,
  sellerStateCode = "27",
  currentShippingCost = 0,
  currentTotal = 0,
  taxAmount = 0,
  isOpen,
  onClose,
  onSuccess,
}: EditAddressDrawerProps) {
  const [fullName, setFullName] = useState(currentAddress.fullName || "");
  const [phone, setPhone] = useState(currentAddress.phone || "");
  const [addressLine1, setAddressLine1] = useState(currentAddress.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(currentAddress.addressLine2 || "");
  const [landmark, setLandmark] = useState(currentAddress.landmark || "");
  const [pincode, setPincode] = useState(currentAddress.pincode || "");
  const [city, setCity] = useState(currentAddress.city || "");
  const [state, setState] = useState(currentAddress.state || "Maharashtra");

  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(currentAddress.fullName || "");
      setPhone(currentAddress.phone || "");
      setAddressLine1(currentAddress.addressLine1 || "");
      setAddressLine2(currentAddress.addressLine2 || "");
      setLandmark(currentAddress.landmark || "");
      setPincode(currentAddress.pincode || "");
      setCity(currentAddress.city || "");
      setState(currentAddress.state || "Maharashtra");
      setError(null);

      if (currentAddress.pincode) {
        checkPincodeService(currentAddress.pincode, currentAddress.state || "Maharashtra");
      }
    }
  }, [isOpen, currentAddress]);

  const checkPincodeService = (code: string, stateName: string) => {
    setCheckingPincode(true);
    const result = resolveShippingRate(code, stateName);
    setServiceability(result);
    setCheckingPincode(false);
  };

  const handlePincodeBlur = () => {
    if (pincode.length === 6) {
      checkPincodeService(pincode, state);
    }
  };

  if (!isOpen) return null;

  // Calculate if changes trigger FI-04a consequences
  const oldStateCode = getStateCodeByName(currentAddress.state || "") || "27";
  const newStateCode = getStateCodeByName(state) || "27";
  const stateChanged = oldStateCode !== newStateCode;

  const oldIsInter = oldStateCode !== sellerStateCode;
  const newIsInter = newStateCode !== sellerStateCode;
  const taxSplitChanged = stateChanged && oldIsInter !== newIsInter;

  const oldPincode = (currentAddress.pincode || "").trim();
  const pincodeChanged = oldPincode !== pincode.trim();

  const newShipping = serviceability?.rate ?? currentShippingCost;
  const shippingDelta = newShipping - currentShippingCost;
  const shippingChanged = Math.abs(shippingDelta) > 0.01;

  const showConsequences = (taxSplitChanged || shippingChanged) && serviceability?.serviceable;
  const newOrderTotal = currentTotal + shippingDelta;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !phone || !addressLine1 || !pincode || !city || !state) {
      setError("Please fill all required fields.");
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }

    if (serviceability && !serviceability.serviceable) {
      setError(serviceability.error || `We do not deliver to ${pincode} yet`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping-address`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          addressLine1,
          addressLine2: addressLine2 || null,
          landmark: landmark || null,
          pincode: pincode.trim(),
          city,
          state,
          actor: "Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update address");
      }

      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col justify-between overflow-y-auto">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit shipping address</h2>
              <p className="text-xs text-slate-500">{orderNumber || `#${orderId.slice(0, 8)}`}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="m-5 mb-0 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form id="editAddressForm" onSubmit={handleSave} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Address line 1 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Flat / House no, Building name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Address line 2
              </label>
              <input
                type="text"
                value={addressLine2 || ""}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Street name, Area"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Landmark</label>
              <input
                type="text"
                value={landmark || ""}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Near temple, metro station, etc."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pincode <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    onBlur={handlePincodeBlur}
                    placeholder="6 digits"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => checkPincodeService(pincode, state)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Check
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  if (pincode) checkPincodeService(pincode, e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Serviceability Status Indicator */}
            {serviceability && (
              <div
                className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                  serviceability.serviceable
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {serviceability.serviceable ? (
                  <>
                    <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                    <span>
                      <strong>Serviceable</strong> — {serviceability.couriers.join(", ")} ({serviceability.zone})
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                    <span>{serviceability.error || `We do not deliver to ${pincode} yet`}</span>
                  </>
                )}
              </div>
            )}

            {/* S5 Dynamic Consequences Block */}
            {showConsequences && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs space-y-2 text-amber-950">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wide">
                  <AlertTriangle size={14} className="text-amber-700" />
                  <span>This changes the order</span>
                </div>

                {taxSplitChanged && (
                  <div className="border-t border-amber-200/60 pt-2">
                    <span className="font-semibold text-slate-900">Tax split: </span>
                    <span>{newIsInter ? "CGST + SGST → IGST" : "IGST → CGST + SGST"}</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Total tax stays {formatINR(taxAmount)}. (Taxable value is unchanged)
                    </p>
                  </div>
                )}

                {shippingChanged && (
                  <div className="border-t border-amber-200/60 pt-2">
                    <span className="font-semibold text-slate-900">Shipping: </span>
                    <span>
                      {formatINR(currentShippingCost)} → {formatINR(newShipping)} ({serviceability?.zone})
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Order total: {formatINR(currentTotal)} → {formatINR(newOrderTotal)}
                    </p>
                    {shippingDelta > 0 ? (
                      <p className="font-semibold text-rose-800 mt-0.5">
                        Customer owes {formatINR(shippingDelta)} more (creates balance due)
                      </p>
                    ) : (
                      <p className="font-semibold text-emerald-800 mt-0.5">
                        Difference of {formatINR(Math.abs(shippingDelta))} flagged as refund-due
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="editAddressForm"
            disabled={saving || (serviceability !== null && !serviceability.serviceable)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>Save Address</span>
          </button>
        </div>
      </div>
    </div>
  );
}
