"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Modal from "@/components/admin/ui/Modal";
import { toast } from "@/components/admin/ui/Toast";
import { formatINR } from "@/lib/utils";
import {
  Layers,
  Sparkles,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Info,
  Sliders,
  DollarSign,
  Tag,
  ToggleLeft,
  Loader2,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import {
  generateVariantCombinations,
  checkSkuAvailability,
  GeneratedVariantPreview,
} from "@/app/admin/(authenticated)/products/variant-actions";
import { getCategoryAttributesWithInheritance } from "@/app/admin/(authenticated)/categories/attribute-actions";

export interface VariantMatrixItem {
  id?: string;
  tempId: string;
  title: string;
  sku: string;
  price: number;
  mrp?: number | null;
  stock: number;
  isActive: boolean;
  isExisting?: boolean;
  combination: Array<{
    attributeId: string;
    attributeName: string;
    attributeValueId: string;
    label: string;
    code: string;
    swatchHex?: string | null;
  }>;
}

interface VariantMatrixBuilderProps {
  categoryId: string;
  categoryName?: string;
  brandSlug?: string;
  categorySlug?: string;
  productTitle: string;
  basePrice: number;
  baseMrp?: number;
  variants: VariantMatrixItem[];
  onChange: (updatedVariants: VariantMatrixItem[]) => void;
  // Single SKU fallback fields when no defining attributes
  singleSku: string;
  onSingleSkuChange: (sku: string) => void;
}

export default function VariantMatrixBuilder({
  categoryId,
  categoryName = "Category",
  brandSlug = "VE",
  categorySlug = "CAT",
  productTitle,
  basePrice,
  baseMrp,
  variants,
  onChange,
  singleSku,
  onSingleSkuChange,
}: VariantMatrixBuilderProps) {
  // Category attributes
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [definingAttributes, setDefiningAttributes] = useState<any[]>([]);

  // Step 1: Selected attribute IDs
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);

  // Step 2: Selected value IDs mapped by attributeId
  const [selectedValueMap, setSelectedValueMap] = useState<Record<string, string[]>>({});

  // Selection for bulk edits
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  // Bulk Edit Modal
  const [bulkModalType, setBulkModalType] = useState<"PRICE" | "MRP" | null>(null);
  const [bulkInputValue, setBulkInputValue] = useState("");

  // SKU validation errors mapped by tempId
  const [skuErrors, setSkuErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  // Load category attributes when category changes
  useEffect(() => {
    if (!categoryId) {
      setDefiningAttributes([]);
      return;
    }

    setLoadingAttrs(true);
    getCategoryAttributesWithInheritance(categoryId).then((res) => {
      setLoadingAttrs(false);
      if (res.ok && res.data) {
        // Filter only variant-defining attributes
        const defAttrs = res.data.attributes.filter((a) => a.isVariantDefining);
        setDefiningAttributes(defAttrs);

        // Pre-select defining attributes if editing existing product with variants
        if (variants.length > 0) {
          const usedAttrIds = new Set<string>();
          const initialValueMap: Record<string, string[]> = {};

          variants.forEach((v) => {
            v.combination.forEach((c) => {
              usedAttrIds.add(c.attributeId);
              if (!initialValueMap[c.attributeId]) {
                initialValueMap[c.attributeId] = [];
              }
              if (!initialValueMap[c.attributeId].includes(c.attributeValueId)) {
                initialValueMap[c.attributeId].push(c.attributeValueId);
              }
            });
          });

          setSelectedAttributeIds(Array.from(usedAttrIds));
          setSelectedValueMap(initialValueMap);
        } else if (defAttrs.length > 0) {
          // Default: select all available defining attributes
          setSelectedAttributeIds(defAttrs.map((a) => a.attributeId));
        }
      }
    });
  }, [categoryId]);

  // Available attributes currently selected
  const activeDefiningAttributes = useMemo(() => {
    return definingAttributes.filter((a) => selectedAttributeIds.includes(a.attributeId));
  }, [definingAttributes, selectedAttributeIds]);

  // Compute live count of combinations
  const calculatedCombinationsCount = useMemo(() => {
    if (activeDefiningAttributes.length === 0) return 0;
    let count = 1;
    for (const attr of activeDefiningAttributes) {
      const selected = selectedValueMap[attr.attributeId] || [];
      if (selected.length === 0) return 0;
      count *= selected.length;
    }
    return count;
  }, [activeDefiningAttributes, selectedValueMap]);

  const exceedsLimit = calculatedCombinationsCount > 200;

  // Toggle attribute selection
  function handleToggleAttribute(attrId: string) {
    setSelectedAttributeIds((prev) =>
      prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]
    );
  }

  // Toggle value selection
  function handleToggleValue(attrId: string, valId: string) {
    setSelectedValueMap((prev) => {
      const current = prev[attrId] || [];
      const next = current.includes(valId)
        ? current.filter((id) => id !== valId)
        : [...current, valId];
      return { ...prev, [attrId]: next };
    });
  }

  // Select all values for an attribute
  function handleSelectAllValues(attr: any) {
    const allValIds = attr.previewValues?.map((v: any) => v.id) || [];
    setSelectedValueMap((prev) => ({
      ...prev,
      [attr.attributeId]: allValIds,
    }));
  }

  // Generate variants
  async function handleGenerate() {
    if (activeDefiningAttributes.length === 0 || calculatedCombinationsCount === 0) return;
    if (exceedsLimit) {
      toast.error("Limit Exceeded", "Cannot generate more than 200 variants per product.");
      return;
    }

    setGenerating(true);

    const payload = activeDefiningAttributes.map((attr) => {
      const selectedIds = selectedValueMap[attr.attributeId] || [];
      const fullValues = (attr.previewValues || []).filter((v: any) =>
        selectedIds.includes(v.id)
      );
      return {
        attributeId: attr.attributeId,
        attributeName: attr.name,
        attributeCode: attr.code,
        values: fullValues.map((v: any) => ({
          id: v.id,
          label: v.label,
          code: v.label.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          swatchHex: v.swatchHex,
        })),
      };
    });

    const res = await generateVariantCombinations({
      brandSlug,
      categorySlug,
      productTitle,
      attributes: payload,
      basePrice,
      baseMrp,
      existingVariants: variants.map((v) => ({
        id: v.id || v.tempId,
        sku: v.sku,
        price: v.price,
        mrp: v.mrp || null,
        stock: v.stock,
        isActive: v.isActive,
        attributeValueIds: v.combination.map((c) => c.attributeValueId),
      })),
    });

    setGenerating(false);

    if (res.ok && res.variants) {
      onChange(res.variants as VariantMatrixItem[]);
      toast.success(
        "Variants Generated",
        `Generated ${res.variants.length} variant(s)${res.newCount ? ` (${res.newCount} new).` : "."}`
      );
    } else {
      toast.error("Generation Failed", res.error || "Failed to generate combinations.");
    }
  }

  // Check SKU uniqueness on blur
  async function handleSkuBlur(tempId: string, sku: string, variantId?: string) {
    if (!sku.trim()) {
      setSkuErrors((prev) => ({ ...prev, [tempId]: "SKU cannot be empty." }));
      return;
    }

    // Check against other variants in the current list
    const duplicateInList = variants.some(
      (v) => v.tempId !== tempId && v.sku.toUpperCase() === sku.trim().toUpperCase()
    );

    if (duplicateInList) {
      setSkuErrors((prev) => ({
        ...prev,
        [tempId]: `Duplicate SKU '${sku}' in this product.`,
      }));
      return;
    }

    const res = await checkSkuAvailability(sku, variantId);
    if (!res.ok) {
      setSkuErrors((prev) => ({ ...prev, [tempId]: res.error || "SKU already taken." }));
    } else {
      setSkuErrors((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
    }
  }

  // Update variant field
  function handleUpdateVariant(tempId: string, field: keyof VariantMatrixItem, value: any) {
    onChange(
      variants.map((v) => {
        if (v.tempId === tempId) {
          return { ...v, [field]: value };
        }
        return v;
      })
    );
  }

  // Remove single variant
  function handleRemoveVariant(tempId: string) {
    onChange(variants.filter((v) => v.tempId !== tempId));
  }

  // Bulk Edit Apply
  function handleApplyBulkEdit() {
    const num = parseFloat(bulkInputValue);
    if (isNaN(num) || num < 0) {
      toast.error("Invalid Input", "Please enter a valid non-negative amount.");
      return;
    }

    if (bulkModalType === "PRICE") {
      onChange(
        variants.map((v) => {
          if (selectedVariantIds.includes(v.tempId)) {
            return { ...v, price: num };
          }
          return v;
        })
      );
      toast.success("Prices Updated", `Applied ₹${num} to ${selectedVariantIds.length} variants.`);
    } else if (bulkModalType === "MRP") {
      onChange(
        variants.map((v) => {
          if (selectedVariantIds.includes(v.tempId)) {
            return { ...v, mrp: num };
          }
          return v;
        })
      );
      toast.success("MRPs Updated", `Applied ₹${num} MRP to ${selectedVariantIds.length} variants.`);
    }

    setBulkModalType(null);
    setBulkInputValue("");
  }

  // Bulk status toggle
  function handleBulkToggleActive(active: boolean) {
    onChange(
      variants.map((v) => {
        if (selectedVariantIds.includes(v.tempId)) {
          return { ...v, isActive: active };
        }
        return v;
      })
    );
    toast.success("Updated", `${selectedVariantIds.length} variants ${active ? "activated" : "deactivated"}.`);
    setSelectedVariantIds([]);
  }

  // Bulk remove
  function handleBulkRemove() {
    onChange(variants.filter((v) => !selectedVariantIds.includes(v.tempId)));
    toast.success("Removed", `Removed ${selectedVariantIds.length} variants.`);
    setSelectedVariantIds([]);
  }

  // Select all / none variants in table
  function handleToggleSelectAll() {
    if (selectedVariantIds.length === variants.length) {
      setSelectedVariantIds([]);
    } else {
      setSelectedVariantIds(variants.map((v) => v.tempId));
    }
  }

  return (
    <div className="space-y-6">
      {/* If category has no variant attributes */}
      {definingAttributes.length === 0 && !loadingAttrs && (
        <div className="p-4 bg-slate-50 border border-admin-border rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Info size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-admin-fg">
                {categoryName} has no variant-defining attributes configured.
              </p>
              <p className="text-xs text-admin-fg-muted mt-0.5">
                This product will be created with a single sellable SKU.
              </p>
            </div>
          </div>
          <Link
            href="/admin/categories"
            className="text-xs font-bold text-brand-orange-600 hover:underline flex-shrink-0"
          >
            Configure {categoryName} attributes →
          </Link>
        </div>
      )}

      {/* Single SKU Fallback Input if no variant attributes */}
      {definingAttributes.length === 0 && (
        <div className="p-4 bg-white border border-admin-border rounded-xl">
          <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg mb-1">
            Product SKU Code <span className="text-brand-orange-600">*</span>
          </label>
          <input
            type="text"
            value={singleSku}
            onChange={(e) => onSingleSkuChange(e.target.value.toUpperCase())}
            placeholder="e.g. VE-FAN-ATOM-1200"
            className="input-base font-mono text-xs w-full max-w-sm h-10 px-3"
          />
          <p className="text-[11px] text-admin-fg-muted mt-1">
            Globally unique inventory tracking code for this single-item product.
          </p>
        </div>
      )}

      {/* Multi-Variant Matrix Configuration */}
      {definingAttributes.length > 0 && (
        <div className="space-y-5">
          {/* STEP 1: CHOOSE DEFINING ATTRIBUTES */}
          <div className="p-4 bg-white border border-admin-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-admin-fg">
                Step 1: Choose Variant-Defining Attributes
              </span>
              <span className="text-[11px] text-admin-fg-muted">
                {activeDefiningAttributes.length} selected
              </span>
            </div>
            <p className="text-xs text-admin-fg-muted mb-3">
              Select which properties make this product vary into distinct SKUs.
            </p>

            <div className="flex flex-wrap gap-2">
              {definingAttributes.map((attr) => {
                const isSelected = selectedAttributeIds.includes(attr.attributeId);
                return (
                  <button
                    key={attr.attributeId}
                    type="button"
                    onClick={() => handleToggleAttribute(attr.attributeId)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "border-brand-orange-500 bg-brand-orange-50 text-brand-orange-700 ring-1 ring-brand-orange-500"
                        : "border-admin-border bg-slate-50 text-admin-fg hover:border-slate-300"
                    }`}
                  >
                    {isSelected ? <Check size={13} /> : <Plus size={13} className="text-slate-400" />}
                    <span>{attr.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: CHOOSE VALUES PER ATTRIBUTE */}
          {activeDefiningAttributes.length > 0 && (
            <div className="p-4 bg-white border border-admin-border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-admin-fg">
                  Step 2: Choose Values For Each Attribute
                </span>
                <span className="text-xs text-admin-fg-muted font-medium">
                  Tick all options this product is manufactured in
                </span>
              </div>

              {activeDefiningAttributes.map((attr) => {
                const selectedValIds = selectedValueMap[attr.attributeId] || [];
                const allVals = attr.previewValues || [];

                return (
                  <div
                    key={attr.attributeId}
                    className="p-3 bg-slate-50 border border-admin-border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-admin-fg">
                        {attr.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllValues(attr)}
                        className="text-[11px] font-bold text-brand-orange-600 hover:underline"
                      >
                        Select All
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {allVals.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          No options found for {attr.name}.
                        </span>
                      ) : (
                        allVals.map((val: any) => {
                          const isValSelected = selectedValIds.includes(val.id);
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={() => handleToggleValue(attr.attributeId, val.id)}
                              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-all flex items-center gap-1.5 ${
                                isValSelected
                                  ? "border-violet-500 bg-violet-50 text-violet-800 font-bold"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {val.swatchHex && (
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0"
                                  style={{ backgroundColor: val.swatchHex }}
                                />
                              )}
                              <span>{val.label}</span>
                              {isValSelected && <Check size={12} className="text-violet-600 ml-0.5" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Combination Counter & Generate CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-admin-border">
                <div>
                  <div
                    className={`text-xs font-bold ${
                      exceedsLimit
                        ? "text-red-600"
                        : calculatedCombinationsCount > 0
                        ? "text-emerald-700"
                        : "text-admin-fg-muted"
                    }`}
                  >
                    {exceedsLimit
                      ? `⚠️ ${calculatedCombinationsCount} combinations exceeds the 200-variant limit.`
                      : calculatedCombinationsCount > 0
                      ? `→ This will generate ${calculatedCombinationsCount} variants.`
                      : "Select at least 1 value per attribute to generate SKUs."}
                  </div>
                  {exceedsLimit && (
                    <p className="text-[11px] text-red-500 mt-0.5">
                      Reduce the selected values, or split this into separate products.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    generating ||
                    calculatedCombinationsCount === 0 ||
                    exceedsLimit
                  }
                  onClick={handleGenerate}
                  className="btn-primary h-10 px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0"
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>Generate Variants Matrix</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VARIANT MATRIX TABLE */}
          {variants.length > 0 && (
            <div className="space-y-3">
              {/* Bulk Action Header Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    {selectedVariantIds.length === variants.length ? (
                      <CheckSquare size={16} className="text-brand-orange-400" />
                    ) : (
                      <Square size={16} className="text-slate-400" />
                    )}
                    <span>
                      {selectedVariantIds.length > 0
                        ? `${selectedVariantIds.length} of ${variants.length} selected`
                        : `Select All (${variants.length})`}
                    </span>
                  </button>
                </div>

                {selectedVariantIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkModalType("PRICE");
                        setBulkInputValue(String(basePrice || ""));
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors"
                    >
                      Set Price
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkModalType("MRP");
                        setBulkInputValue(String(baseMrp || ""));
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors"
                    >
                      Set MRP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleActive(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors"
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkRemove}
                      className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-800 transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedVariantIds([])}
                      className="text-xs text-slate-400 hover:text-slate-200 underline ml-1"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="border border-admin-border rounded-xl bg-white overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-admin-border text-[11px] font-bold uppercase tracking-wider text-admin-fg-muted">
                      <th className="py-2.5 px-3 w-10"></th>
                      <th className="py-2.5 px-3">Variant Combination</th>
                      <th className="py-2.5 px-3">SKU Code</th>
                      <th className="py-2.5 px-3 w-32">Selling Price (₹)</th>
                      <th className="py-2.5 px-3 w-32">MRP (₹)</th>
                      <th className="py-2.5 px-3 w-24 text-center">Stock</th>
                      <th className="py-2.5 px-3 w-20 text-center">Active</th>
                      <th className="py-2.5 px-3 w-12 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variants.map((variant) => {
                      const isSelected = selectedVariantIds.includes(variant.tempId);
                      const error = skuErrors[variant.tempId];

                      return (
                        <tr
                          key={variant.tempId}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            !variant.isActive ? "opacity-60 bg-slate-50/60" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedVariantIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== variant.tempId)
                                    : [...prev, variant.tempId]
                                )
                              }
                              className="rounded border-slate-300 text-brand-orange-600 focus:ring-brand-orange-500 cursor-pointer"
                            />
                          </td>

                          {/* Combination Title */}
                          <td className="py-2 px-3">
                            <div className="font-bold text-admin-fg flex items-center gap-1.5">
                              {variant.combination.map((c, ci) => (
                                <span key={ci} className="inline-flex items-center gap-1">
                                  {c.swatchHex && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                      style={{ backgroundColor: c.swatchHex }}
                                    />
                                  )}
                                  <span>{c.label}</span>
                                  {ci < variant.combination.length - 1 && (
                                    <span className="text-slate-300">/</span>
                                  )}
                                </span>
                              ))}
                            </div>
                            {variant.isExisting && (
                              <span className="text-[10px] font-medium text-blue-600">
                                Existing SKU
                              </span>
                            )}
                          </td>

                          {/* SKU Input */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={variant.sku}
                              onChange={(e) =>
                                handleUpdateVariant(variant.tempId, "sku", e.target.value.toUpperCase())
                              }
                              onBlur={(e) =>
                                handleSkuBlur(variant.tempId, e.target.value, variant.id)
                              }
                              className={`input-base font-mono text-xs h-8 px-2 w-full max-w-[200px] ${
                                error ? "border-red-400 bg-red-50" : ""
                              }`}
                            />
                            {error && (
                              <p className="text-[10px] text-red-600 mt-0.5">{error}</p>
                            )}
                          </td>

                          {/* Selling Price */}
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={variant.price}
                              onChange={(e) =>
                                handleUpdateVariant(variant.tempId, "price", parseFloat(e.target.value) || 0)
                              }
                              className="input-base font-mono text-xs h-8 px-2 w-full"
                            />
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={variant.mrp ?? ""}
                              placeholder="Optional"
                              onChange={(e) =>
                                handleUpdateVariant(
                                  variant.tempId,
                                  "mrp",
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              className="input-base font-mono text-xs h-8 px-2 w-full"
                            />
                            {variant.mrp !== null &&
                              variant.mrp !== undefined &&
                              variant.mrp < variant.price && (
                                <p className="text-[10px] text-amber-600 mt-0.5">MRP &lt; Price</p>
                              )}
                          </td>

                          {/* Stock (Read-only per D-08, managed in Inventory) */}
                          <td className="py-2 px-3 text-center font-mono text-xs text-admin-fg">
                            <span
                              title="Stock is managed via Inventory Adjustments"
                              className="cursor-help px-2 py-0.5 rounded bg-slate-100 font-bold"
                            >
                              {variant.stock}
                            </span>
                          </td>

                          {/* Active Toggle */}
                          <td className="py-2 px-3 text-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={variant.isActive}
                                onChange={(e) =>
                                  handleUpdateVariant(variant.tempId, "isActive", e.target.checked)
                                }
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </td>

                          {/* Remove Button */}
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(variant.tempId)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              title="Exclude variant combination"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Set Price / MRP Modal */}
      <Modal
        isOpen={Boolean(bulkModalType)}
        onClose={() => setBulkModalType(null)}
        title={`Set ${bulkModalType === "PRICE" ? "Selling Price" : "MRP"} for ${selectedVariantIds.length} Variants`}
        subtitle="This value will be applied across all currently selected rows."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkModalType(null)}
              className="btn-secondary text-xs h-9 px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyBulkEdit}
              className="btn-primary text-xs h-9 px-4 font-bold uppercase tracking-wider"
            >
              Apply to {selectedVariantIds.length} Variants
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg">
            Enter {bulkModalType === "PRICE" ? "Price" : "MRP"} in INR (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={bulkInputValue}
              onChange={(e) => setBulkInputValue(e.target.value)}
              className="input-base font-mono text-sm w-full h-10 pl-7 pr-3"
              placeholder="0.00"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
