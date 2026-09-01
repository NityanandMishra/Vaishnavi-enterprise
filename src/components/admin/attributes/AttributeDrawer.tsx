"use client";

import React, { useState, useEffect, useRef } from "react";
import Drawer from "@/components/admin/ui/Drawer";
import Modal from "@/components/admin/ui/Modal";
import { toast } from "@/components/admin/ui/Toast";
import {
  List,
  CheckSquare,
  Type,
  Hash,
  ToggleLeft,
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Palette,
  FileText,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Info,
} from "lucide-react";
import {
  getAttributeById,
  createAttribute,
  updateAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  reorderAttributeValues,
  bulkCreateAttributeValues,
} from "@/app/admin/(authenticated)/attributes/actions";
import {
  attributeInputSchema,
  attributeValueInputSchema,
  formatAttributeZodErrors,
} from "@/lib/validations/attribute";

interface AttributeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  attributeId?: string | null; // null = create mode
  onSaved: () => void;
}

interface AttributeValueItem {
  id: string;
  label: string;
  code: string;
  swatchHex?: string | null;
  swatchImageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  variantCount: number;
}

const INPUT_TYPES = [
  {
    id: "SINGLE_SELECT",
    label: "Single Select",
    description: "Choose one option from a list (e.g. Size, Colour, Storage)",
    icon: List,
    preview: "Dropdown",
  },
  {
    id: "MULTI_SELECT",
    label: "Multi Select",
    description: "Choose multiple options from a list (e.g. Compatible Models)",
    icon: CheckSquare,
    preview: "Tags / Chips",
  },
  {
    id: "TEXT",
    label: "Text",
    description: "Free text entry (e.g. Fabric Care, Origin, Inclusions)",
    icon: Type,
    preview: "Text Field",
  },
  {
    id: "NUMBER",
    label: "Number",
    description: "Numeric value (e.g. Wattage, Weight, Voltage)",
    icon: Hash,
    preview: "0.00 Unit",
  },
  {
    id: "BOOLEAN",
    label: "Yes / No",
    description: "Binary true or false flag (e.g. Remote Included, Dimmable)",
    icon: ToggleLeft,
    preview: "Toggle Switch",
  },
];

export default function AttributeDrawer({
  isOpen,
  onClose,
  attributeId,
  onSaved,
}: AttributeDrawerProps) {
  const isEditMode = Boolean(attributeId);
  const [activeTab, setActiveTab] = useState<"details" | "values">("details");

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [inputType, setInputType] = useState("SINGLE_SELECT");
  const [isVariantDefining, setIsVariantDefining] = useState(false);
  const [usesSwatches, setUsesSwatches] = useState(false);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // States for Values tab
  const [values, setValues] = useState<AttributeValueItem[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Inline value adding
  const [newValueLabel, setNewValueLabel] = useState("");
  const [newValueSwatch, setNewValueSwatch] = useState("#3B82F6");
  const [addingValue, setAddingValue] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Editing value inline
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueLabel, setEditingValueLabel] = useState("");
  const [editingValueSwatch, setEditingValueSwatch] = useState("");

  // Bulk paste modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Load attribute if edit mode
  useEffect(() => {
    if (!isOpen) return;

    if (attributeId) {
      setLoading(true);
      setError(null);
      getAttributeById(attributeId).then((res) => {
        setLoading(false);
        if (res.ok && res.data) {
          const d = res.data;
          setName(d.name);
          setCode(d.code);
          setInputType(d.inputType);
          setIsVariantDefining(d.isVariantDefining);
          setUsesSwatches(d.usesSwatches);
          setDescription(d.description || "");
          setIsActive(d.isActive);
          setValues(d.values as any);
          setProductsCount(d.productsCount || 0);
          setIsCodeManual(true);
        } else {
          setError(res.error || "Failed to load attribute.");
        }
      });
    } else {
      // Reset for create
      setName("");
      setCode("");
      setIsCodeManual(false);
      setInputType("SINGLE_SELECT");
      setIsVariantDefining(true);
      setUsesSwatches(false);
      setDescription("");
      setIsActive(true);
      setValues([]);
      setProductsCount(0);
      setActiveTab("details");
      setError(null);
    }
  }, [isOpen, attributeId]);

  // Handle auto-slug on name change
  function handleNameChange(val: string) {
    setName(val);
    if (!isEditMode && !isCodeManual) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/^_+|_+$/g, "");
      setCode(generated);
    }
    // Auto-detect swatches if name contains colour/shade/finish
    if (!isEditMode && /colou?r|shade|finish/i.test(val)) {
      setUsesSwatches(true);
    }
  }

  // Handle Input Type change
  function handleInputTypeChange(type: string) {
    if (isEditMode && values.length > 0) return; // Locked if values exist
    setInputType(type);
    if (type !== "SINGLE_SELECT") {
      setIsVariantDefining(false);
    }
  }

  // Handle Save details
  async function handleSaveDetails(andAddValues = false) {
    setError(null);
    setFieldErrors({});

    const normalizedCode = code.trim() || name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const payload = {
      name: name.trim(),
      code: normalizedCode,
      inputType,
      isVariantDefining: inputType === "SINGLE_SELECT" ? isVariantDefining : false,
      usesSwatches,
      description: description.trim() || undefined,
      isActive,
    };

    const parsed = attributeInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errMap = formatAttributeZodErrors(parsed.error);
      setFieldErrors(errMap);
      setError(parsed.error.issues[0]?.message || "Validation failed");
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && attributeId) {
        const res = await updateAttribute(attributeId, {
          name: payload.name,
          description: payload.description,
          usesSwatches: payload.usesSwatches,
          isActive: payload.isActive,
          isVariantDefining: payload.isVariantDefining,
        });

        if (!res.ok) {
          setError(res.error || "Failed to update attribute.");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        } else {
          toast.success("Attribute Updated", `'${name}' was saved successfully.`);
          onSaved();
          if (andAddValues && (inputType === "SINGLE_SELECT" || inputType === "MULTI_SELECT")) {
            setActiveTab("values");
          } else {
            onClose();
          }
        }
      } else {
        const res = await createAttribute(payload);

        if (!res.ok) {
          setError(res.error || "Failed to create attribute.");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        } else {
          toast.success("Attribute Created", `'${name}' created. Add its values next.`);
          onSaved();
          if (res.data?.id && (inputType === "SINGLE_SELECT" || inputType === "MULTI_SELECT")) {
            setActiveTab("values");
            // Set current id to newly created attribute
            getAttributeById(res.data.id).then((r) => {
              if (r.ok && r.data) {
                setValues(r.data.values as any);
              }
            });
          } else {
            onClose();
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  // Inline Add Value
  async function handleAddValue(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newValueLabel.trim()) {
      toast.error("Validation Error", "Option label is required.");
      return;
    }
    if (!attributeId) return;

    const valuePayload = {
      label: newValueLabel.trim(),
      code: newValueLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      swatchHex: usesSwatches && newValueSwatch ? newValueSwatch : undefined,
    };
    const parsedVal = attributeValueInputSchema.safeParse(valuePayload);
    if (!parsedVal.success) {
      toast.error("Validation Error", parsedVal.error.issues[0]?.message);
      return;
    }

    setAddingValue(true);
    const res = await createAttributeValue(attributeId, {
      label: valuePayload.label,
      swatchHex: valuePayload.swatchHex,
    });
    setAddingValue(false);

    if (res.ok && res.data) {
      setValues((prev) => [...prev, { ...res.data, variantCount: 0 } as any]);
      setNewValueLabel("");
      toast.success("Value Added", `'${res.data.label}' added.`);
      // Refocus input immediately for rapid entry
      setTimeout(() => {
        valueInputRef.current?.focus();
      }, 50);
      onSaved();
    } else {
      toast.error("Error Adding Value", res.error || "Failed to add value.");
    }
  }

  // Inline Edit Value
  async function handleSaveEditingValue(valId: string) {
    if (!editingValueLabel.trim()) return;

    const res = await updateAttributeValue(valId, {
      label: editingValueLabel,
      swatchHex: usesSwatches ? editingValueSwatch : undefined,
    });

    if (res.ok) {
      setValues((prev) =>
        prev.map((v) =>
          v.id === valId
            ? {
                ...v,
                label: editingValueLabel,
                swatchHex: usesSwatches ? editingValueSwatch : v.swatchHex,
              }
            : v
        )
      );
      setEditingValueId(null);
      toast.success("Value Updated", "Attribute value updated.");
      onSaved();
    } else {
      toast.error("Error", res.error || "Failed to update value.");
    }
  }

  // Delete Value
  async function handleDeleteValue(valId: string, label: string) {
    const res = await deleteAttributeValue(valId);
    if (res.ok) {
      setValues((prev) => prev.filter((v) => v.id !== valId));
      toast.success("Value Removed", `'${label}' removed.`);
      onSaved();
    } else {
      toast.error("Cannot Delete", res.error || "Value is in use.");
    }
  }

  // Reorder values
  async function handleMoveValue(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= values.length) return;

    const newArr = [...values];
    const [moved] = newArr.splice(index, 1);
    newArr.splice(targetIndex, 0, moved);

    setValues(newArr);
    if (attributeId) {
      await reorderAttributeValues(attributeId, newArr.map((v) => v.id));
      toast.success("Order Updated", "Attribute values order updated.");
      onSaved();
    }
  }

  // Bulk Paste Values
  async function handleBulkSubmit() {
    if (!bulkText.trim() || !attributeId) return;

    setBulkSaving(true);
    const res = await bulkCreateAttributeValues(attributeId, bulkText);
    setBulkSaving(false);

    if (res.ok) {
      toast.success("Values Added", res.message || "Bulk values processed.");
      setIsBulkModalOpen(false);
      setBulkText("");
      // Refresh values
      getAttributeById(attributeId).then((r) => {
        if (r.ok && r.data) setValues(r.data.values as any);
      });
      onSaved();
    } else {
      toast.error("Error", res.error || "Failed to process values.");
    }
  }

  const isSelectType = inputType === "SINGLE_SELECT" || inputType === "MULTI_SELECT";

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={isEditMode ? `Edit ${name || "Attribute"}` : "Create Attribute"}
        subtitle={
          isEditMode
            ? `Code: ${code} · ${values.length} value(s) · Used by ${productsCount} product(s)`
            : "Define a reusable attribute for categories and products"
        }
        width="wide"
        footer={
          activeTab === "details" ? (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-secondary h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {isSelectType && (
                  <button
                    type="button"
                    onClick={() => handleSaveDetails(true)}
                    disabled={saving}
                    className="btn-secondary h-10 px-4 text-xs font-semibold text-brand-orange-600 border-brand-orange-200 hover:bg-brand-orange-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                    Save & Add Values →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveDetails(false)}
                  disabled={saving}
                  className="btn-primary h-10 px-5 text-xs font-bold uppercase tracking-wider"
                >
                  {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                  {saving ? "Saving…" : "Save Attribute"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-admin-fg-muted font-medium">
                {values.length} option(s) configured
              </span>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary h-10 px-6 text-xs font-bold uppercase tracking-wider"
              >
                Done
              </button>
            </div>
          )
        }
      >
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-admin-fg-muted">
            <Loader2 size={24} className="animate-spin text-brand-orange-500 mb-2" />
            <p className="text-xs font-medium">Loading attribute details…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs Header */}
            <div className="flex border-b border-admin-border -mt-2">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-brand-orange-500 text-brand-orange-600"
                    : "border-transparent text-admin-fg-muted hover:text-admin-fg"
                }`}
              >
                1. Details & Configuration
              </button>
              <button
                type="button"
                onClick={() => isSelectType && isEditMode && setActiveTab("values")}
                disabled={!isSelectType || !isEditMode}
                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "values"
                    ? "border-brand-orange-500 text-brand-orange-600"
                    : !isSelectType || !isEditMode
                    ? "border-transparent text-slate-300 cursor-not-allowed opacity-50"
                    : "border-transparent text-admin-fg-muted hover:text-admin-fg"
                }`}
              >
                <span>2. Values & Options</span>
                {values.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-mono text-slate-700">
                    {values.length}
                  </span>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: DETAILS */}
            {activeTab === "details" && (
              <div className="space-y-5">
                {/* Name & Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg mb-1">
                      Name <span className="text-brand-orange-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        handleNameChange(e.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.name;
                            return next;
                          });
                        }
                      }}
                      placeholder="e.g. Blade Sweep, Colour, Voltage"
                      className={`input-base text-sm w-full h-10 px-3 ${
                        fieldErrors.name ? "border-rose-400 bg-rose-50/30" : ""
                      }`}
                    />
                    {fieldErrors.name ? (
                      <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle size={12} className="shrink-0" />
                        {fieldErrors.name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-admin-fg-muted mt-1">
                        How this appears on product forms and filters.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg mb-1">
                      Code <span className="text-brand-orange-600">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={isEditMode}
                      value={code}
                      onChange={(e) => {
                        setIsCodeManual(true);
                        setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                        if (fieldErrors.code) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.code;
                            return next;
                          });
                        }
                      }}
                      placeholder="e.g. blade_sweep"
                      className={`input-base font-mono text-xs w-full h-10 px-3 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 ${
                        fieldErrors.code ? "border-rose-400 bg-rose-50/30" : ""
                      }`}
                    />
                    {fieldErrors.code ? (
                      <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle size={12} className="shrink-0" />
                        {fieldErrors.code}
                      </p>
                    ) : (
                      <p className="text-[11px] text-admin-fg-muted mt-1">
                        {isEditMode
                          ? "Code is locked after creation to preserve SKUs."
                          : "Used internally and in SKU generation. Immutable after save."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Input Type Radio Cards */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg mb-2">
                    Input Type <span className="text-brand-orange-600">*</span>
                  </label>
                  {isEditMode && values.length > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-md mb-2 flex items-center gap-1.5">
                      <Info size={14} />
                      Type cannot be changed because this attribute already has options.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {INPUT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = inputType === type.id;
                      const isLocked = isEditMode && values.length > 0 && !isSelected;

                      return (
                        <div
                          key={type.id}
                          onClick={() => !isLocked && handleInputTypeChange(type.id)}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "border-brand-orange-500 bg-brand-orange-50/50 ring-1 ring-brand-orange-500"
                              : isLocked
                              ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200"
                              : "border-admin-border hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 font-bold text-xs text-admin-fg">
                              <Icon size={15} className={isSelected ? "text-brand-orange-600" : "text-admin-fg-muted"} />
                              <span>{type.label}</span>
                            </div>
                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {type.preview}
                            </span>
                          </div>
                          <p className="text-[11px] text-admin-fg-muted leading-relaxed">
                            {type.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Variant Behaviour Callout Box */}
                <div className={`p-4 rounded-xl border transition-all ${
                  isVariantDefining
                    ? "bg-violet-50/60 border-violet-200"
                    : "bg-slate-50 border-admin-border"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-admin-fg">
                          Variant Defining Behaviour
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isVariantDefining
                            ? "bg-violet-100 text-violet-800"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {isVariantDefining ? "Creates SKUs" : "Informational"}
                        </span>
                      </div>
                      <p className="text-xs text-admin-fg-muted leading-relaxed">
                        {isVariantDefining
                          ? "ON: Each chosen option multiplies into separate sellable units with independent price, MRP, and stock (e.g. 1200mm vs 1400mm)."
                          : "OFF: Describes the product specification (e.g. Care Instructions, Country of Origin) without creating separate sellable items."}
                      </p>
                      {inputType !== "SINGLE_SELECT" && (
                        <p className="text-[11px] font-medium text-amber-700 mt-1.5 flex items-center gap-1">
                          <AlertCircle size={13} />
                          Only Single Select attributes can create sellable SKUs.
                        </p>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={isVariantDefining}
                        disabled={inputType !== "SINGLE_SELECT"}
                        onChange={(e) => setIsVariantDefining(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
                    </label>
                  </div>
                </div>

                {/* Swatches Toggle */}
                {isSelectType && (
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-admin-border bg-white">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-admin-fg">
                        <Palette size={15} className="text-brand-orange-500" />
                        <span>Enable Swatches</span>
                      </div>
                      <p className="text-[11px] text-admin-fg-muted mt-0.5">
                        Shows colour hex preview circles or image thumbnails for each value.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usesSwatches}
                        onChange={(e) => setUsesSwatches(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange-600"></div>
                    </label>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-admin-fg mb-1">
                    Description (Internal Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Internal guidance on when staff should select this attribute…"
                    className="input-base text-xs w-full p-2.5 resize-none"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-admin-border">
                  <div>
                    <span className="text-xs font-bold text-admin-fg block">Active Status</span>
                    <p className="text-[11px] text-admin-fg-muted">
                      {isActive
                        ? "Visible and available for newly created product forms."
                        : "Hidden from new product forms. Existing products retain their values."}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: VALUES */}
            {activeTab === "values" && (
              <div className="space-y-4">
                {/* Inline Rapid Add Form */}
                <form
                  onSubmit={handleAddValue}
                  className="p-3 bg-slate-50 border border-admin-border rounded-xl flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      ref={valueInputRef}
                      type="text"
                      required
                      value={newValueLabel}
                      onChange={(e) => setNewValueLabel(e.target.value)}
                      placeholder="Type option label and press Enter (e.g. 1200mm, Red, 3kVA)…"
                      className="input-base text-xs w-full h-9 px-3"
                    />
                  </div>

                  {usesSwatches && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 bg-white border border-admin-border rounded-lg px-2 h-9">
                      <input
                        type="color"
                        value={newValueSwatch}
                        onChange={(e) => setNewValueSwatch(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-admin-fg-muted uppercase">
                        {newValueSwatch}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={addingValue || !newValueLabel.trim()}
                    className="btn-primary h-9 px-3 text-xs font-bold flex items-center gap-1 flex-shrink-0"
                  >
                    {addingValue ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                    <span>Add</span>
                  </button>
                </form>

                {/* Secondary Action: Bulk Paste */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-admin-fg-muted font-medium">
                    Drag handle ⣿ or use arrows to set display order.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(true)}
                    className="text-brand-orange-600 font-bold hover:underline"
                  >
                    + Paste multiple values
                  </button>
                </div>

                {/* Values List */}
                {values.length === 0 ? (
                  <div className="p-8 border border-dashed border-admin-border rounded-xl text-center text-admin-fg-muted">
                    <p className="text-xs font-semibold">No values added yet.</p>
                    <p className="text-[11px] text-admin-fg-muted mt-1">
                      Add the options buyers and staff can choose from above.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-admin-border rounded-xl bg-white overflow-hidden">
                    {values.map((val, idx) => {
                      const isEditing = editingValueId === val.id;
                      const hasVariants = val.variantCount > 0;

                      return (
                        <div
                          key={val.id}
                          className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70 transition-colors group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Drag / Reorder Buttons */}
                            <div className="flex items-center text-slate-400">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveValue(idx, "up")}
                                className="p-1 hover:text-admin-fg disabled:opacity-20"
                                title="Move Up"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === values.length - 1}
                                onClick={() => handleMoveValue(idx, "down")}
                                className="p-1 hover:text-admin-fg disabled:opacity-20"
                                title="Move Down"
                              >
                                <ArrowDown size={12} />
                              </button>
                              <GripVertical size={14} className="cursor-grab text-slate-300" />
                            </div>

                            {/* Swatch Pill */}
                            {usesSwatches && (
                              <div
                                className="w-5 h-5 rounded-full border border-slate-300 flex-shrink-0 shadow-xs"
                                style={{ backgroundColor: val.swatchHex || "#E2E8F0" }}
                                title={val.swatchHex || "No colour"}
                              />
                            )}

                            {/* Label / Inline Editor */}
                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingValueLabel}
                                  onChange={(e) => setEditingValueLabel(e.target.value)}
                                  className="input-base text-xs h-7 px-2 flex-1"
                                />
                                {usesSwatches && (
                                  <input
                                    type="color"
                                    value={editingValueSwatch}
                                    onChange={(e) => setEditingValueSwatch(e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer border-none"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditingValue(val.id)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingValueId(null)}
                                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-2 truncate">
                                <span className="text-xs font-bold text-admin-fg truncate">
                                  {val.label}
                                </span>
                                <span className="text-[10px] font-mono text-admin-fg-muted">
                                  code: {val.code}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right Controls */}
                          {!isEditing && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                  hasVariants
                                    ? "bg-slate-100 text-slate-700 font-semibold"
                                    : "text-slate-400"
                                }`}
                              >
                                {val.variantCount} variant{val.variantCount === 1 ? "" : "s"}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingValueId(val.id);
                                  setEditingValueLabel(val.label);
                                  setEditingValueSwatch(val.swatchHex || "#000000");
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                title="Edit label"
                              >
                                <Pencil size={13} />
                              </button>

                              <button
                                type="button"
                                disabled={hasVariants}
                                onClick={() => handleDeleteValue(val.id, val.label)}
                                className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                                title={
                                  hasVariants
                                    ? `In use by ${val.variantCount} variant(s). Deactivate instead.`
                                    : "Delete value"
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Bulk Paste Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Paste Multiple Attribute Values"
        subtitle="Quickly add multiple options separated by new lines or commas"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="btn-secondary text-xs h-9 px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkSaving || !bulkText.trim()}
              onClick={handleBulkSubmit}
              className="btn-primary text-xs h-9 px-4 font-bold uppercase tracking-wider"
            >
              {bulkSaving ? "Processing…" : "Add All Values"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-admin-fg-muted">
            Paste one option per line (e.g. shoe sizes, power ratings, colors). Any duplicates will
            be skipped automatically.
          </p>
          <textarea
            rows={8}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Red\nNavy Blue\nForest Green\nCharcoal Black\nGolden Yellow`}
            className="input-base text-xs w-full p-3 font-mono"
          />
        </div>
      </Modal>
    </>
  );
}
