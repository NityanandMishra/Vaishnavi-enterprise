"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/admin/ui/Toast";
import {
  MapPin,
  Plus,
  Trash2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Info,
  Layers,
  Percent,
  Check,
  Save,
} from "lucide-react";
import Link from "next/link";
import { formatPaise, rupeesToPaise } from "@/lib/money";

interface ZoneRule {
  id: string;
  matchType: "PINCODE" | "PINCODE_RANGE" | "STATE" | "REGION";
  pincode?: string | null;
  pincodeFrom?: string | null;
  pincodeTo?: string | null;
  stateCode?: string | null;
  region?: string | null;
  specificity: number;
}

interface RateSlab {
  id?: string;
  minWeightGrams?: number | null;
  maxWeightGrams?: number | null;
  amountPaise: number;
  perAdditionalWeightGrams?: number | null;
  perAdditionalAmountPaise?: number | null;
}

interface ShippingRate {
  id?: string;
  rateType: "FLAT" | "WEIGHT_SLAB" | "VALUE_SLAB" | "FREE_ABOVE";
  flatAmountPaise?: number | null;
  freeAbovePaise?: number | null;
  codSurchargePaise?: number | null;
  codSurchargePercent?: number | null;
  slabs?: RateSlab[];
}

interface ShippingZone {
  id: string;
  name: string;
  priority: number;
  isFallback: boolean;
  isActive: boolean;
  rules: ZoneRule[];
  rates: ShippingRate[];
}

export default function ShippingZonesManager() {
  const { addToast } = useToast();

  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New zone modal
  const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZonePriority, setNewZonePriority] = useState(1);

  // Add rule inputs
  const [newRuleType, setNewRuleType] = useState<"PINCODE" | "PINCODE_RANGE" | "STATE" | "REGION">("PINCODE_RANGE");
  const [exactPincodesInput, setExactPincodesInput] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [stateCodeInput, setStateCodeInput] = useState("");
  const [regionInput, setRegionInput] = useState("WEST");

  // Editable rate state for selected zone
  const [rateType, setRateType] = useState<"FLAT" | "WEIGHT_SLAB">("FLAT");
  const [flatAmountRupees, setFlatAmountRupees] = useState("49");
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);
  const [freeShippingRupees, setFreeShippingRupees] = useState("999");
  const [codSurchargeType, setCodSurchargeType] = useState<"NONE" | "FLAT" | "PERCENT">("FLAT");
  const [codFlatRupees, setCodFlatRupees] = useState("30");
  const [codPercent, setCodPercent] = useState("2");

  // Weight slabs state
  const [slabs, setSlabs] = useState<RateSlab[]>([
    { minWeightGrams: 0, maxWeightGrams: 500, amountPaise: 3500 },
    { minWeightGrams: 501, maxWeightGrams: 1000, amountPaise: 4900 },
    {
      minWeightGrams: 1001,
      maxWeightGrams: null,
      amountPaise: 7900,
      perAdditionalWeightGrams: 500,
      perAdditionalAmountPaise: 2000,
    },
  ]);

  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    fetchZones();
  }, []);

  async function fetchZones() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shipping/zones");
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
        if (data.zones && data.zones.length > 0 && !selectedZoneId) {
          setSelectedZoneId(data.zones[0].id);
        }
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch zones", "error");
    } finally {
      setLoading(false);
    }
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;

  // Sync selected zone's rate into state
  useEffect(() => {
    if (!selectedZone) return;

    const activeRate = selectedZone.rates?.[0];
    if (activeRate) {
      setRateType(activeRate.rateType === "WEIGHT_SLAB" ? "WEIGHT_SLAB" : "FLAT");
      setFlatAmountRupees(activeRate.flatAmountPaise ? (activeRate.flatAmountPaise / 100).toFixed(0) : "49");
      if (activeRate.freeAbovePaise) {
        setFreeShippingEnabled(true);
        setFreeShippingRupees((activeRate.freeAbovePaise / 100).toFixed(0));
      } else {
        setFreeShippingEnabled(false);
      }

      if (activeRate.codSurchargePaise) {
        setCodSurchargeType("FLAT");
        setCodFlatRupees((activeRate.codSurchargePaise / 100).toFixed(0));
      } else if (activeRate.codSurchargePercent) {
        setCodSurchargeType("PERCENT");
        setCodPercent(activeRate.codSurchargePercent.toString());
      } else {
        setCodSurchargeType("NONE");
      }

      if (activeRate.slabs && activeRate.slabs.length > 0) {
        setSlabs(activeRate.slabs);
      }
    }
  }, [selectedZoneId, zones]);

  async function handleAddZone() {
    if (!newZoneName.trim()) {
      addToast("Zone name is required", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/shipping/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newZoneName.trim(),
          priority: newZonePriority,
          isFallback: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create zone");
      }

      const data = await res.json();
      addToast(`Zone '${data.zone.name}' created!`, "success");
      setIsAddZoneModalOpen(false);
      setNewZoneName("");
      fetchZones();
      setSelectedZoneId(data.zone.id);
    } catch (e: any) {
      addToast(e.message, "error");
    }
  }

  async function handleAddRule() {
    if (!selectedZone) return;

    try {
      let body: any = { matchType: newRuleType };

      if (newRuleType === "PINCODE") {
        if (!exactPincodesInput.trim()) {
          addToast("Enter at least one 6-digit pincode", "error");
          return;
        }
        body.pincodes = exactPincodesInput;
      } else if (newRuleType === "PINCODE_RANGE") {
        if (!/^\d{6}$/.test(rangeFrom.trim()) || !/^\d{6}$/.test(rangeTo.trim())) {
          addToast("Both from and to must be valid 6-digit pincodes", "error");
          return;
        }
        body.pincodeFrom = rangeFrom.trim();
        body.pincodeTo = rangeTo.trim();
      } else if (newRuleType === "STATE") {
        if (!stateCodeInput.trim()) {
          addToast("Select or enter a 2-digit state code (e.g. 27)", "error");
          return;
        }
        body.stateCode = stateCodeInput.trim();
      } else if (newRuleType === "REGION") {
        body.region = regionInput;
      }

      const res = await fetch(`/api/admin/shipping/zones/${selectedZone.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        // FR-02: Overlapping zone definitions at the same specificity are rejected
        throw new Error(err.error || "Failed to add coverage rule");
      }

      addToast("Coverage rule added successfully!", "success");
      setExactPincodesInput("");
      setRangeFrom("");
      setRangeTo("");
      fetchZones();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      const res = await fetch(`/api/admin/shipping/zone-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast("Rule removed", "success");
        fetchZones();
      }
    } catch (e) {
      addToast("Failed to delete rule", "error");
    }
  }

  function handleAddSlab() {
    const lastSlab = slabs[slabs.length - 1];
    const prevUpperBound = lastSlab?.maxWeightGrams || 1000;
    const newLowerBound = prevUpperBound + 1;

    // Update current last slab to be bounded
    const updatedSlabs = [...slabs];
    if (lastSlab && lastSlab.maxWeightGrams === null) {
      updatedSlabs[updatedSlabs.length - 1].maxWeightGrams = newLowerBound + 499;
    }

    updatedSlabs.push({
      minWeightGrams: newLowerBound + 500,
      maxWeightGrams: null, // Final slab is open-ended
      amountPaise: (lastSlab?.amountPaise || 4900) + 2000,
      perAdditionalWeightGrams: 500,
      perAdditionalAmountPaise: 2000,
    });

    setSlabs(updatedSlabs);
  }

  function handleRemoveSlab(index: number) {
    if (slabs.length <= 1) {
      addToast("At least one slab is required", "error");
      return;
    }
    const updated = slabs.filter((_, i) => i !== index);
    // Ensure final slab is open-ended
    updated[updated.length - 1].maxWeightGrams = null;
    setSlabs(updated);
  }

  async function handleSaveRates() {
    if (!selectedZone) return;
    setSavingRate(true);

    try {
      const body: any = {
        rateType,
        freeAbovePaise: freeShippingEnabled ? rupeesToPaise(parseFloat(freeShippingRupees) || 0) : null,
        codSurchargePaise: codSurchargeType === "FLAT" ? rupeesToPaise(parseFloat(codFlatRupees) || 0) : null,
        codSurchargePercent: codSurchargeType === "PERCENT" ? parseFloat(codPercent) || 0 : null,
      };

      if (rateType === "FLAT") {
        body.flatAmountPaise = rupeesToPaise(parseFloat(flatAmountRupees) || 0);
      } else {
        body.slabs = slabs;
      }

      const res = await fetch(`/api/admin/shipping/zones/${selectedZone.id}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save rate configuration");
      }

      addToast("Zone rates saved successfully!", "success");
      fetchZones();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSavingRate(false);
    }
  }

  // Get sample pincode for "Test this zone" link
  let samplePincode = "560001";
  if (selectedZone) {
    for (const r of selectedZone.rules) {
      if (r.pincode) {
        samplePincode = r.pincode;
        break;
      }
      if (r.pincodeFrom) {
        samplePincode = r.pincodeFrom;
        break;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--gray-900)] dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" /> Shipping Zones & Rates
          </h1>
          <p className="text-xs text-[var(--gray-500)] mt-1">
            Group destinations and configure weight slabs, flat rates, and COD surcharges.
          </p>
        </div>

        <button
          onClick={() => setIsAddZoneModalOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Zone
        </button>
      </div>

      {/* MASTER-DETAIL LAYOUT: Left (320px) | Right (fluid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ZONE LIST */}
        <div className="lg:col-span-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm overflow-hidden">
          <div className="p-3.5 bg-[var(--gray-50)] dark:bg-[var(--gray-800)] border-b border-[var(--gray-200)] dark:border-[var(--gray-700)] flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--gray-500)]">
            <span>Zones ({zones.length})</span>
            <span className="text-[10px] text-blue-600 font-bold">Ordered by Specificity</span>
          </div>

          <div className="divide-y divide-[var(--gray-200)] dark:divide-[var(--gray-700)]">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-500">Loading zones...</div>
            ) : (
              zones.map((z) => {
                const isSelected = selectedZoneId === z.id;
                const activeRate = z.rates?.[0];
                let rateSnippet = "No rate set";
                if (activeRate) {
                  if (activeRate.rateType === "FLAT") {
                    rateSnippet = formatPaise(activeRate.flatAmountPaise || 0);
                  } else {
                    rateSnippet = "By weight";
                  }
                }

                return (
                  <div
                    key={z.id}
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-600"
                        : "hover:bg-[var(--gray-50)] dark:hover:bg-[var(--gray-800)]"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                        {z.name}
                        {z.isFallback && (
                          <span title="Protected fallback zone">
                            <Lock className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--gray-500)] mt-0.5">
                        {z.rules.length} coverage rule{z.rules.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs font-mono">{rateSnippet}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ZONE DETAIL */}
        <div className="lg:col-span-8 space-y-6">
          {selectedZone ? (
            <>
              {/* SECTION 1 — COVERAGE */}
              <div className="p-6 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-[var(--gray-900)] dark:text-white">
                      Coverage Rules · {selectedZone.name}
                    </h2>
                    <p className="text-xs text-[var(--gray-500)]">
                      {selectedZone.isFallback
                        ? "Fallback zone: catches all pincodes not covered by more specific zones."
                        : "Matches pincodes, ranges, states, or geographical regions."}
                    </p>
                  </div>
                </div>

                {/* RULES LIST */}
                <div className="space-y-2">
                  {selectedZone.rules.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 border border-dashed rounded-lg">
                      No coverage rules assigned to this zone yet.
                    </div>
                  ) : (
                    selectedZone.rules.map((r) => {
                      let description = "";
                      if (r.matchType === "PINCODE") description = `Exact pincode: ${r.pincode}`;
                      else if (r.matchType === "PINCODE_RANGE")
                        description = `Pincode range: ${r.pincodeFrom} – ${r.pincodeTo}`;
                      else if (r.matchType === "STATE") description = `State Code: ${r.stateCode}`;
                      else if (r.matchType === "REGION") description = `Region: ${r.region}`;

                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-lg text-xs bg-[var(--gray-50)] dark:bg-[var(--gray-800)]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              [{r.matchType}]
                            </span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {description}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              (Specificity: {r.specificity})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="p-1 hover:text-rose-600 text-gray-400"
                            title="Remove rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ADD COVERAGE RULE */}
                {!selectedZone.isFallback && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--gray-500)]">
                      + Add Coverage Rule
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <select
                        value={newRuleType}
                        onChange={(e: any) => setNewRuleType(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)]"
                      >
                        <option value="PINCODE_RANGE">Pincode Range</option>
                        <option value="PINCODE">Exact Pincode(s)</option>
                        <option value="STATE">State (GST code)</option>
                        <option value="REGION">Geographic Region</option>
                      </select>

                      {newRuleType === "PINCODE_RANGE" && (
                        <>
                          <input
                            type="text"
                            placeholder="From (e.g. 400001)"
                            value={rangeFrom}
                            onChange={(e) => setRangeFrom(e.target.value)}
                            className="px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)] font-mono"
                          />
                          <input
                            type="text"
                            placeholder="To (e.g. 400104)"
                            value={rangeTo}
                            onChange={(e) => setRangeTo(e.target.value)}
                            className="px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)] font-mono"
                          />
                        </>
                      )}

                      {newRuleType === "PINCODE" && (
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="Comma-separated (e.g. 400001, 400002)"
                            value={exactPincodesInput}
                            onChange={(e) => setExactPincodesInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)] font-mono"
                          />
                        </div>
                      )}

                      {newRuleType === "STATE" && (
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="State Code (e.g. 27 for Maharashtra)"
                            value={stateCodeInput}
                            onChange={(e) => setStateCodeInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)] font-mono"
                          />
                        </div>
                      )}

                      {newRuleType === "REGION" && (
                        <div className="sm:col-span-2">
                          <select
                            value={regionInput}
                            onChange={(e) => setRegionInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[var(--gray-800)]"
                          >
                            <option value="NORTH">North India</option>
                            <option value="SOUTH">South India</option>
                            <option value="EAST">East India</option>
                            <option value="WEST">West India</option>
                            <option value="NORTH_EAST">North-East India</option>
                          </select>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAddRule}
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:opacity-90"
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2 — RATES */}
              <div className="p-6 border border-[var(--gray-200)] dark:border-[var(--gray-700)] rounded-xl bg-white dark:bg-[var(--gray-900)] shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[var(--gray-900)] dark:text-white">
                  Shipping Rates
                </h3>

                <div className="flex gap-4 text-xs font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="rateType"
                      value="FLAT"
                      checked={rateType === "FLAT"}
                      onChange={() => setRateType("FLAT")}
                    />
                    Flat Rate
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="rateType"
                      value="WEIGHT_SLAB"
                      checked={rateType === "WEIGHT_SLAB"}
                      onChange={() => setRateType("WEIGHT_SLAB")}
                    />
                    By Weight Slabs
                  </label>
                </div>

                {rateType === "FLAT" ? (
                  <div className="p-4 bg-[var(--gray-50)] dark:bg-[var(--gray-800)] border rounded-lg flex items-center gap-3">
                    <span className="text-xs font-medium">Flat Charge:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold">₹</span>
                      <input
                        type="number"
                        min={0}
                        value={flatAmountRupees}
                        onChange={(e) => setFlatAmountRupees(e.target.value)}
                        className="w-24 px-2 py-1 text-sm border rounded bg-white dark:bg-[var(--gray-900)]"
                      />
                    </div>
                  </div>
                ) : (
                  /* WEIGHT SLABS */
                  <div className="space-y-3">
                    <div className="text-xs text-[var(--gray-500)]">
                      Slabs are contiguous with an open-ended final slab.
                    </div>

                    <div className="space-y-2">
                      {slabs.map((slab, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2.5 border rounded-lg bg-[var(--gray-50)] dark:bg-[var(--gray-800)] text-xs"
                        >
                          <span className="font-mono">{slab.minWeightGrams} g</span>
                          <span>–</span>
                          {slab.maxWeightGrams === null ? (
                            <span className="font-semibold text-blue-600">No limit</span>
                          ) : (
                            <span className="font-mono">{slab.maxWeightGrams} g</span>
                          )}

                          <span className="ml-auto font-bold">
                            ₹{(slab.amountPaise / 100).toFixed(2)}
                          </span>

                          {slab.maxWeightGrams === null && slab.perAdditionalWeightGrams && (
                            <span className="text-[11px] text-gray-500">
                              (+ ₹{((slab.perAdditionalAmountPaise || 0) / 100).toFixed(0)} per{" "}
                              {slab.perAdditionalWeightGrams}g)
                            </span>
                          )}

                          {slabs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlab(idx)}
                              className="p-1 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSlab}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add slab
                    </button>
                  </div>
                )}

                {/* SECTION 3 — FREE SHIPPING */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="freeShipping"
                      checked={freeShippingEnabled}
                      onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="freeShipping" className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Free shipping above threshold
                    </label>
                  </div>

                  {freeShippingEnabled && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-xs">₹</span>
                      <input
                        type="number"
                        value={freeShippingRupees}
                        onChange={(e) => setFreeShippingRupees(e.target.value)}
                        className="w-28 px-2 py-1 text-xs border rounded bg-white dark:bg-[var(--gray-800)]"
                      />
                      <span className="text-xs text-gray-500">
                        Evaluated on the order value after discount.
                      </span>
                    </div>
                  )}
                </div>

                {/* SECTION 4 — COD SURCHARGE */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    COD Surcharge
                  </h4>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="codType"
                        value="NONE"
                        checked={codSurchargeType === "NONE"}
                        onChange={() => setCodSurchargeType("NONE")}
                      />
                      None
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="codType"
                        value="FLAT"
                        checked={codSurchargeType === "FLAT"}
                        onChange={() => setCodSurchargeType("FLAT")}
                      />
                      Flat ₹
                      <input
                        type="number"
                        value={codFlatRupees}
                        onChange={(e) => setCodFlatRupees(e.target.value)}
                        className="w-16 px-1.5 py-0.5 border rounded ml-1 bg-white dark:bg-[var(--gray-800)]"
                      />
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="codType"
                        value="PERCENT"
                        checked={codSurchargeType === "PERCENT"}
                        onChange={() => setCodSurchargeType("PERCENT")}
                      />
                      Percentage
                      <input
                        type="number"
                        value={codPercent}
                        onChange={(e) => setCodPercent(e.target.value)}
                        className="w-14 px-1.5 py-0.5 border rounded ml-1 bg-white dark:bg-[var(--gray-800)]"
                      />
                      %
                    </label>
                  </div>
                </div>

                {/* SAVE FOOTER */}
                <div className="pt-4 flex justify-between items-center border-t border-gray-100 dark:border-gray-800">
                  <Link
                    href={`/admin/shipping/calculator?pincode=${samplePincode}`}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Test this zone in Rate Calculator →
                  </Link>

                  <button
                    type="button"
                    disabled={savingRate}
                    onClick={handleSaveRates}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingRate ? "Saving..." : "Save Rate Changes"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500 border rounded-xl">
              Select a zone from the list to view and edit its coverage and rates.
            </div>
          )}
        </div>
      </div>

      {/* ADD ZONE MODAL */}
      {isAddZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[var(--gray-900)] rounded-xl max-w-sm w-full p-6 space-y-4 border border-[var(--gray-200)] dark:border-[var(--gray-700)] shadow-2xl">
            <h3 className="text-base font-bold">Add Delivery Zone</h3>
            <div>
              <label className="text-xs font-medium block mb-1">Zone Name *</label>
              <input
                type="text"
                placeholder="e.g. South India / Bangalore Metro"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Priority (Resolution Order)</label>
              <input
                type="number"
                min={1}
                value={newZonePriority}
                onChange={(e) => setNewZonePriority(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-[var(--gray-800)] text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddZoneModalOpen(false)}
                className="px-3 py-2 text-xs border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddZone}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg"
              >
                Create Zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
