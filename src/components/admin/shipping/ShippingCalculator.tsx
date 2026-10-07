"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { formatPaise } from "@/lib/money";
import { Calculator, CheckCircle2, XCircle, Clock, Info, ArrowRight } from "lucide-react";
import { useToast } from "@/components/admin/ui/Toast";

export default function ShippingCalculator() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const [pincode, setPincode] = useState(searchParams.get("pincode") || "560001");
  const [weightGrams, setWeightGrams] = useState(1350);
  const [orderValueRupees, setOrderValueRupees] = useState("899.00");
  const [isCod, setIsCod] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    handleCalculate();
  }, []);

  async function handleCalculate() {
    if (!/^\d{6}$/.test(pincode.trim())) {
      addToast("Please enter a valid 6-digit destination pincode", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/shipping/rate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: pincode.trim(),
          weightGrams,
          orderValue: parseFloat(orderValueRupees) || 0,
          isCod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Rate calculation failed");
      }

      setResult(data);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--gray-900)] dark:text-white flex items-center gap-2">
          <Calculator className="w-6 h-6 text-blue-600" /> Shipping Rate Calculator
        </h1>
        <p className="text-xs text-[var(--gray-500)] mt-1">
          Simulate rate resolution and verify zone rules, weight slabs, and courier serviceability with full prose explanation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* INPUTS COLUMN */}
        <div className="md:col-span-5 p-6 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gray-500)]">
            Inputs
          </h2>

          <div>
            <label className="text-xs font-semibold block mb-1">Destination Pincode *</label>
            <input
              type="text"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm bg-white dark:bg-[var(--gray-800)]"
              placeholder="e.g. 560001"
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Shipment Weight *</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={weightGrams}
                onChange={(e) => setWeightGrams(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[var(--gray-800)]"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">grams</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Order Value (Post-Discount) *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-gray-500">₹</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={orderValueRupees}
                onChange={(e) => setOrderValueRupees(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm bg-white dark:bg-[var(--gray-800)]"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={isCod}
                onChange={(e) => setIsCod(e.target.checked)}
                className="rounded text-blue-600"
              />
              Cash on Delivery (COD) Order
            </label>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleCalculate}
            className="w-full py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? "Calculating..." : "Resolve Shipping Charge"}
          </button>
        </div>

        {/* RESULTS & EXPLANATION COLUMN */}
        <div className="md:col-span-7 space-y-4">
          {result ? (
            <>
              {/* RESULTS BREAKDOWN TABLE */}
              <div className="p-6 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gray-500)] flex justify-between items-center">
                  <span>Charge Breakdown</span>
                  <span className="text-xs font-mono font-normal text-emerald-600 dark:text-emerald-400">
                    {result.serviceable ? "✓ Serviceable" : "✗ Unserviceable"}
                  </span>
                </h2>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Zone</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {result.zoneName}
                    </span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Rule Applied</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {result.ruleApplied}
                    </span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Base Charge</span>
                    <span className="font-mono font-medium">
                      {formatPaise(result.baseChargePaise)}
                    </span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">COD Surcharge</span>
                    <span className="font-mono font-medium">
                      {result.codSurchargePaise > 0
                        ? formatPaise(result.codSurchargePaise)
                        : "₹0.00"}
                    </span>
                  </div>

                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Free Shipping</span>
                    <span
                      className={`font-semibold ${
                        result.freeShippingApplied ? "text-emerald-600" : "text-gray-400"
                      }`}
                    >
                      {result.freeShippingApplied ? "Applied (₹0.00 base)" : "Not applied"}
                    </span>
                  </div>

                  <div className="pt-3 pb-1 flex justify-between items-center border-t-2 border-gray-200 dark:border-gray-700 font-bold text-sm">
                    <span>Total Shipping Charge</span>
                    <span className="text-base text-blue-600 dark:text-blue-400 font-mono">
                      {formatPaise(result.totalShippingChargePaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CRITICAL PRD REQUIREMENT: PROSE EXPLANATION */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Resolution Explanation
                </div>
                <p className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-sans">
                  {result.explanation}
                </p>
              </div>

              {/* COURIER SERVICEABILITY & TRANSIT DAYS */}
              <div className="p-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
                  Courier Serviceability for {pincode}
                </h3>

                <div className="space-y-2">
                  {result.courierOptions && result.courierOptions.length > 0 ? (
                    result.courierOptions.map((co: any) => (
                      <div
                        key={co.courierId}
                        className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                          co.serviceable
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-200"
                            : "bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-500 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {co.serviceable ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="font-semibold">{co.courierName}</span>
                          {co.serviceable && co.transitDays && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300 ml-2">
                              <Clock className="w-3 h-3" /> {co.transitDays} days expected
                            </span>
                          )}
                        </div>

                        <div>
                          {co.serviceable ? (
                            <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                              {co.costPaise ? `Cost: ${formatPaise(co.costPaise)}` : "Serviceable"}
                            </span>
                          ) : (
                            <span className="text-[11px] text-rose-500">Not serviceable</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400">No couriers registered</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-gray-400 border rounded-xl">
              Enter pincode and weight on the left to calculate rate and see explanation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
