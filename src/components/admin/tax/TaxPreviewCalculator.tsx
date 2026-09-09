"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Calculator,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  Building,
  Truck,
  RotateCcw,
} from "lucide-react";
import {
  PageHeader,
  SearchableSelect,
  SelectOption,
  CurrencyInput,
} from "@/components/admin/ui";
import { INDIAN_STATES, getStateNameByCode } from "@/lib/tax/indian-states";
import { calculateTax } from "@/lib/tax/tax-engine";

export interface HsnTaxData {
  id: string;
  code: string;
  description: string;
  rateType: string;
  cessRate?: number | null;
  rateVersions: Array<{
    id: string;
    gstRate?: number | null;
    effectiveFrom: string | Date;
    effectiveTo?: string | Date | null;
    slabs?: Array<{
      id?: string;
      minPrice: number;
      maxPrice?: number | null;
      gstRate: number;
    }>;
  }>;
}

export interface CategoryTaxItem {
  id: string;
  name: string;
  hsnId: string | null;
  hsnCode: string | null;
  source: string;
}

export default function TaxPreviewCalculator({
  hsns,
  categories,
  sellerStateCode,
  pricingMode,
}: {
  hsns: HsnTaxData[];
  categories: CategoryTaxItem[];
  sellerStateCode: string;
  pricingMode: string;
}) {
  // Input states — Defaulting to the exact scenario from PRD B.4 / TAX-08
  const [price, setPrice] = useState<number>(1299);
  const [quantity, setQuantity] = useState<number>(2);
  const [discount, setDiscount] = useState<number>(100);
  const [selectedHsnId, setSelectedHsnId] = useState<string>(() => {
    const apparelHsn = hsns.find((h) => h.code === "6109") || hsns[0];
    return apparelHsn ? apparelHsn.id : "";
  });
  const [deliveryStateCode, setDeliveryStateCode] = useState<string>(sellerStateCode || "27");

  // Optional: Category picker mode
  const [testByMode, setTestByMode] = useState<"HSN" | "CATEGORY">("HSN");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const sellerStateName = getStateNameByCode(sellerStateCode);
  const deliveryStateName = getStateNameByCode(deliveryStateCode);

  const hsnOptions: SelectOption[] = useMemo(
    () =>
      hsns.map((h) => ({
        value: h.id,
        label: `${h.code} — ${h.description}`,
        description: h.rateType === "SLAB" ? "Price Slabs" : "Flat Rate",
      })),
    [hsns]
  );

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
        description: c.hsnCode ? `HSN ${c.hsnCode} (${c.source})` : "⚠️ Unmapped",
      })),
    [categories]
  );

  // When a category is chosen, update selectedHsnId
  function handleCategoryChange(catId: string) {
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.hsnId) {
      setSelectedHsnId(cat.hsnId);
    } else {
      setSelectedHsnId("");
    }
  }

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const activeHsnObj = useMemo(
    () => hsns.find((h) => h.id === selectedHsnId),
    [hsns, selectedHsnId]
  );

  // Live calculation
  const calculation = useMemo(() => {
    if (!activeHsnObj) return null;
    if (price < 0 || quantity <= 0 || discount < 0) return null;

    try {
      return calculateTax({
        unitPrice: price,
        quantity,
        discountPerUnit: discount,
        hsn: activeHsnObj,
        sellerStateCode,
        deliveryStateCode,
        pricingMode,
      });
    } catch (err: any) {
      return { error: err.message };
    }
  }, [
    activeHsnObj,
    price,
    quantity,
    discount,
    sellerStateCode,
    deliveryStateCode,
    pricingMode,
  ]);

  function handleReset() {
    setPrice(1299);
    setQuantity(2);
    setDiscount(100);
    const apparel = hsns.find((h) => h.code === "6109") || hsns[0];
    if (apparel) setSelectedHsnId(apparel.id);
    setDeliveryStateCode(sellerStateCode || "27");
    setTestByMode("HSN");
    setSelectedCategoryId("");
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Tax Calculation Preview"
        subtitle="Verify tax rates, intra/inter-state split, and apparel price slabs without placing an order"
        overflowActions={[
          {
            label: "Reset to Default Scenario",
            icon: RotateCcw,
            onClick: handleReset,
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-6 bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--gray-200)] pb-3">
            <h2 className="text-[var(--text-base)] font-bold text-[var(--gray-900)] flex items-center gap-2">
              <Calculator size={18} className="text-[var(--blue-600)]" />
              Calculation Parameters
            </h2>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-[var(--gray-100)] p-0.5 rounded-[var(--radius-md)] text-[var(--text-xs)] font-medium">
              <button
                type="button"
                onClick={() => setTestByMode("HSN")}
                className={`px-2.5 py-1 rounded transition-all ${
                  testByMode === "HSN"
                    ? "bg-white text-[var(--gray-900)] font-bold shadow-sm"
                    : "text-[var(--gray-600)] hover:text-[var(--gray-900)]"
                }`}
              >
                By HSN Code
              </button>
              <button
                type="button"
                onClick={() => setTestByMode("CATEGORY")}
                className={`px-2.5 py-1 rounded transition-all ${
                  testByMode === "CATEGORY"
                    ? "bg-white text-[var(--gray-900)] font-bold shadow-sm"
                    : "text-[var(--gray-600)] hover:text-[var(--gray-900)]"
                }`}
              >
                By Category
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Price & Quantity Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                  Item Price <span className="text-[var(--red-500)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-medium">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-[var(--text-sm)] font-mono border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                  Quantity <span className="text-[var(--red-500)]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-[var(--text-sm)] font-mono border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
                />
              </div>
            </div>

            {/* Discount per unit */}
            <div>
              <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                Discount (per unit)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 text-[var(--text-sm)] font-mono border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
                />
              </div>
              <p className="text-[11px] text-[var(--gray-500)] mt-1">
                Discount reduces the per-unit price before slab evaluation (TR-04).
              </p>
            </div>

            {/* HSN or Category Selector */}
            {testByMode === "HSN" ? (
              <div>
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                  HSN Tax Code <span className="text-[var(--red-500)]">*</span>
                </label>
                <SearchableSelect
                  options={hsnOptions}
                  value={selectedHsnId}
                  onChange={(val) => setSelectedHsnId(val as string)}
                  placeholder="Select HSN code..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1">
                  Test by Category <span className="text-[var(--red-500)]">*</span>
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={selectedCategoryId}
                  onChange={(val) => handleCategoryChange(val as string)}
                  placeholder="Select category to test..."
                />

                {selectedCategoryObj && !selectedCategoryObj.hsnId && (
                  <div className="mt-2 p-2.5 bg-[var(--amber-50)] border border-[var(--amber-200)] text-[var(--amber-900)] rounded-[var(--radius-md)] text-[var(--text-xs)] flex items-center justify-between">
                    <span>No HSN mapped for this category</span>
                    <Link
                      href="/admin/tax/mapping"
                      className="font-bold text-[var(--amber-800)] hover:underline"
                    >
                      Map HSN →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Delivery State Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider">
                  Deliver To State <span className="text-[var(--red-500)]">*</span>
                </label>
                <span className="text-[11px] text-[var(--gray-500)]">
                  Origin: <span className="font-semibold text-[var(--gray-800)]">{sellerStateName}</span>
                </span>
              </div>
              <select
                value={deliveryStateCode}
                onChange={(e) => setDeliveryStateCode(e.target.value)}
                className="w-full px-3 py-2 text-[var(--text-sm)] bg-white border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name} {s.code === sellerStateCode ? "(Origin: Intra-State)" : "(Inter-State)"}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--gray-500)] mt-1">
                Changing delivery state flips intra-state (CGST+SGST) vs inter-state (IGST) live.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE RESULTS */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--gray-200)] pb-3">
              <h2 className="text-[var(--text-base)] font-bold text-[var(--gray-900)]">
                Tax Breakdown Result
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--blue-50)] text-[var(--blue-700)] border border-[var(--blue-200)]">
                {pricingMode} PRICING
              </span>
            </div>

            {!activeHsnObj ? (
              <div className="py-12 text-center text-[var(--gray-500)] space-y-2">
                <AlertTriangle size={24} className="mx-auto text-[var(--amber-500)]" />
                <p className="text-[var(--text-sm)]">
                  {testByMode === "CATEGORY" && selectedCategoryId && !selectedCategoryObj?.hsnId
                    ? "This category has no HSN mapping. Select a mapped category or assign an HSN code."
                    : "Please select an HSN code to preview the calculation."}
                </p>
              </div>
            ) : calculation && "error" in calculation ? (
              <div className="p-3 bg-[var(--red-50)] text-[var(--red-800)] text-[var(--text-sm)] rounded">
                Calculation error: {calculation.error}
              </div>
            ) : calculation ? (
              <div className="space-y-3">
                {/* Two-step line display (TR-03) */}
                <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)]">
                  <span className="text-[var(--gray-600)]">Per-unit after discount</span>
                  <span className="font-mono font-semibold text-[var(--gray-900)]">
                    ₹{calculation.perUnitAfterDiscount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)]">
                  <span className="text-[var(--gray-600)]">
                    Taxable value (× {quantity})
                  </span>
                  <span className="font-mono font-semibold text-[var(--gray-900)]">
                    ₹{calculation.taxableValue.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)]">
                  <span className="text-[var(--gray-600)] flex items-center gap-1.5">
                    GST Rate
                    {calculation.slabApplied && (
                      <span className="text-[11px] font-medium text-[var(--violet-700)] bg-[var(--violet-50)] px-1.5 py-0.2 rounded border border-[var(--violet-200)]">
                        Slab: {calculation.slabApplied.label}
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-[var(--blue-700)]">
                    {calculation.gstRate}%
                  </span>
                </div>

                {/* CGST + SGST (Intra-state) */}
                {calculation.isIntraState ? (
                  <>
                    <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4">
                      <span className="text-[var(--gray-600)]">
                        CGST @ {calculation.cgstRate}%
                      </span>
                      <span className="font-mono text-[var(--gray-900)]">
                        ₹{calculation.cgstAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4">
                      <span className="text-[var(--gray-600)]">
                        SGST @ {calculation.sgstRate}%
                      </span>
                      <span className="font-mono text-[var(--gray-900)]">
                        ₹{calculation.sgstAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4 opacity-40">
                      <span className="text-[var(--gray-600)]">IGST</span>
                      <span className="font-mono text-[var(--gray-900)]">—</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4 opacity-40">
                      <span className="text-[var(--gray-600)]">CGST / SGST</span>
                      <span className="font-mono text-[var(--gray-900)]">—</span>
                    </div>

                    <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4">
                      <span className="text-[var(--gray-600)]">
                        IGST @ {calculation.igstRate}%
                      </span>
                      <span className="font-mono font-bold text-[var(--gray-900)]">
                        ₹{calculation.igstAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}

                {calculation.cessAmount > 0 && (
                  <div className="flex justify-between items-center text-[var(--text-sm)] pb-1 border-b border-[var(--gray-100)] pl-4">
                    <span className="text-[var(--gray-600)]">
                      CESS @ {calculation.cessRate}%
                    </span>
                    <span className="font-mono text-[var(--amber-800)] font-semibold">
                      ₹{calculation.cessAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Line Total */}
                <div className="flex justify-between items-center pt-3 border-t-2 border-[var(--gray-900)]">
                  <span className="text-[var(--text-base)] font-bold text-[var(--gray-900)]">
                    Line Total
                  </span>
                  <span className="text-[var(--text-xl)] font-mono font-bold text-[var(--blue-700)]">
                    ₹{calculation.lineTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Explanation Strip (PRD B.4 / S7) */}
          {calculation && !("error" in calculation) && (
            <div className="p-4 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-lg)] space-y-1.5">
              <span className="text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider block">
                Calculation Audit Note
              </span>
              <p className="text-[var(--text-xs)] text-[var(--gray-700)] leading-relaxed">
                {calculation.breakdownNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
