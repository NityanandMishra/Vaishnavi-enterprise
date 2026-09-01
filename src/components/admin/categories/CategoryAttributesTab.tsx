"use client";

import React, { useState, useEffect, useCallback } from "react";
import Drawer from "@/components/admin/ui/Drawer";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { toast } from "@/components/admin/ui/Toast";
import {
  FolderTree,
  Plus,
  Lock,
  GripVertical,
  Trash2,
  AlertCircle,
  Info,
  Loader2,
  Check,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  getCategoryAttributesWithInheritance,
  attachAttributesToCategory,
  updateCategoryAttribute,
  reorderCategoryAttributes,
  detachCategoryAttribute,
  CategoryAttributeItem,
} from "@/app/admin/(authenticated)/categories/attribute-actions";
import { getAttributes } from "@/app/admin/(authenticated)/attributes/actions";

interface CategoryAttributesTabProps {
  categoryId: string;
  categoryName: string;
}

export default function CategoryAttributesTab({
  categoryId,
  categoryName,
}: CategoryAttributesTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    category: { id: string; name: string; parentId: string | null; parentName: string | null };
    attributes: CategoryAttributeItem[];
    inheritedCount: number;
  } | null>(null);

  // Attach Drawer
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [availableAttributes, setAvailableAttributes] = useState<any[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attachSearch, setAttachSearch] = useState("");
  const [attaching, setAttaching] = useState(false);

  // Detach Confirmation
  const [detachTarget, setDetachTarget] = useState<CategoryAttributeItem | null>(null);
  const [isDetaching, setIsDetaching] = useState(false);

  const fetchCategoryAttributes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCategoryAttributesWithInheritance(categoryId);
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Failed to load category attributes.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load category attributes.");
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchCategoryAttributes();
  }, [fetchCategoryAttributes]);

  // Load available attributes for attach drawer
  async function openAttachDrawer() {
    setIsAttachOpen(true);
    setSelectedAttributeIds([]);
    setAttachSearch("");
    const res = await getAttributes({ limit: 100, isActive: "true" });
    if (res.ok && res.data) {
      setAvailableAttributes(res.data);
    }
  }

  // Handle Attach
  async function handleConfirmAttach() {
    if (selectedAttributeIds.length === 0) return;

    setAttaching(true);
    const res = await attachAttributesToCategory(categoryId, selectedAttributeIds);
    setAttaching(false);

    if (res.ok) {
      toast.success("Attributes Attached", res.message || "Attached attributes to category.");
      setIsAttachOpen(false);
      fetchCategoryAttributes();
    } else {
      toast.error("Cannot Attach", res.error || "Failed to attach attributes.");
    }
  }

  // Handle Required Toggle
  async function handleToggleRequired(attr: CategoryAttributeItem) {
    if (attr.isInherited && !attr.canLoosenRequired) {
      toast.info(
        "Inherited Requirement",
        `'${attr.inheritedFromName}' requires this attribute. Sub-categories cannot make it optional.`
      );
      return;
    }

    const nextRequired = !attr.isRequired;
    const res = await updateCategoryAttribute(categoryId, attr.attributeId, {
      isRequired: nextRequired,
    });

    if (res.ok) {
      toast.success("Updated", `'${attr.name}' is now ${nextRequired ? "required" : "optional"}.`);
      fetchCategoryAttributes();
    } else {
      toast.error("Error", res.error || "Failed to update required flag.");
    }
  }

  // Handle Reorder
  async function handleMove(index: number, direction: "up" | "down") {
    if (!data) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= data.attributes.length) return;

    const list = [...data.attributes];
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);

    setData({ ...data, attributes: list });

    const res = await reorderCategoryAttributes(categoryId, list.map((a) => a.attributeId));
    if (res.ok) {
      toast.success("Order Saved", "Product form field display order updated.");
    }
  }

  // Handle Detach
  async function handleConfirmDetach() {
    if (!detachTarget) return;

    setIsDetaching(true);
    const res = await detachCategoryAttribute(categoryId, detachTarget.attributeId);
    setIsDetaching(false);

    if (res.ok) {
      toast.success("Attribute Detached", res.message);
      setDetachTarget(null);
      fetchCategoryAttributes();
    } else {
      toast.error("Error", "Failed to detach attribute.");
    }
  }

  const attachedIdSet = new Set(data?.attributes.map((a) => a.attributeId) || []);

  const filteredAvailable = availableAttributes.filter((a) => {
    if (!attachSearch.trim()) return true;
    const q = attachSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-admin-border rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-admin-fg">
            Attributes for {categoryName}
          </h3>
          <p className="text-xs text-admin-fg-muted mt-0.5">
            Products created in this category will dynamically display these fields in this order.
          </p>
        </div>
        <button
          type="button"
          onClick={openAttachDrawer}
          className="btn-primary h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus size={14} />
          <span>Attach Attribute</span>
        </button>
      </div>

      {/* Inheritance Notice Banner for sub-categories */}
      {data?.category?.parentId && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
          <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              Inherited from {data.category.parentName || "Parent Category"}:
            </span>{" "}
            {data.inheritedCount} attribute(s) are automatically inherited. Inherited attributes
            cannot be removed from sub-categories, but you can mark optional ones as required here.
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Attributes Table */}
      {loading ? (
        <div className="p-12 text-center text-admin-fg-muted">
          <Loader2 size={24} className="animate-spin text-brand-orange-500 mx-auto mb-2" />
          <p className="text-xs font-medium">Loading category attributes…</p>
        </div>
      ) : !data || data.attributes.length === 0 ? (
        <div className="p-10 border border-dashed border-admin-border rounded-xl text-center bg-white">
          <p className="text-xs font-semibold text-admin-fg">No attributes attached.</p>
          <p className="text-[11px] text-admin-fg-muted mt-1 max-w-sm mx-auto">
            Products in this category will only show basic fields (title, base price, images).
            Attach attributes to enable custom options and variants.
          </p>
          <button
            type="button"
            onClick={openAttachDrawer}
            className="btn-secondary h-8 px-3 text-xs font-bold mt-4"
          >
            + Attach Attribute
          </button>
        </div>
      ) : (
        <div className="border border-admin-border rounded-xl bg-white overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-admin-border text-[11px] font-bold uppercase tracking-wider text-admin-fg-muted">
                <th className="py-2.5 px-3 w-16">Order</th>
                <th className="py-2.5 px-3">Attribute</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Variant?</th>
                <th className="py-2.5 px-3">Required</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.attributes.map((attr, idx) => (
                <tr
                  key={attr.attributeId}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    attr.isInherited ? "bg-slate-50/40" : ""
                  }`}
                >
                  {/* Order / Drag Handle */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-0.5 text-slate-400">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, "up")}
                        className="p-1 hover:text-admin-fg disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === data.attributes.length - 1}
                        onClick={() => handleMove(idx, "down")}
                        className="p-1 hover:text-admin-fg disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <GripVertical size={13} className="text-slate-300 ml-0.5" />
                    </div>
                  </td>

                  {/* Attribute Name & Code */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-admin-fg">{attr.name}</div>
                    <div className="font-mono text-[10px] text-admin-fg-muted">
                      {attr.code}
                    </div>
                  </td>

                  {/* Input Type */}
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {attr.inputType.replace("_", " ")}
                    </span>
                  </td>

                  {/* Variant Badge */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        attr.isVariantDefining
                          ? "bg-violet-100 text-violet-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {attr.isVariantDefining ? "Variant" : "Info"}
                    </span>
                  </td>

                  {/* Required Toggle */}
                  <td className="py-2.5 px-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attr.isRequired}
                        disabled={attr.isInherited && !attr.canLoosenRequired}
                        onChange={() => handleToggleRequired(attr)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                    </label>
                  </td>

                  {/* Source / Inheritance Indicator */}
                  <td className="py-2.5 px-3">
                    {attr.isInherited ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Lock size={11} className="text-slate-400" />
                        <span>{attr.inheritedFromName}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-admin-fg">
                        This category
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      disabled={!attr.canRemove}
                      onClick={() => setDetachTarget(attr)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded disabled:opacity-20 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                      title={
                        attr.isInherited
                          ? `Inherited from ${attr.inheritedFromName}. Remove it there to remove it here.`
                          : "Detach attribute"
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Attach Attributes Drawer */}
      <Drawer
        isOpen={isAttachOpen}
        onClose={() => setIsAttachOpen(false)}
        title={`Attach Attributes to ${categoryName}`}
        subtitle="Select attributes to make available on products in this category"
        width="wide"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setIsAttachOpen(false)}
              className="btn-secondary h-10 px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={attaching || selectedAttributeIds.length === 0}
              onClick={handleConfirmAttach}
              className="btn-primary h-10 px-5 text-xs font-bold uppercase tracking-wider"
            >
              {attaching ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              {selectedAttributeIds.length > 0
                ? `Attach ${selectedAttributeIds.length} Attribute${selectedAttributeIds.length === 1 ? "" : "s"}`
                : "Attach Attributes"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={attachSearch}
              onChange={(e) => setAttachSearch(e.target.value)}
              placeholder="Search available attributes…"
              className="input-base text-xs w-full h-10 pl-9 pr-3"
            />
          </div>

          {/* List of available attributes */}
          <div className="divide-y divide-slate-100 border border-admin-border rounded-xl bg-white overflow-hidden max-h-[420px] overflow-y-auto">
            {filteredAvailable.length === 0 ? (
              <div className="p-8 text-center text-xs text-admin-fg-muted">
                No matching attributes found.
              </div>
            ) : (
              filteredAvailable.map((attr) => {
                const isAlreadyAttached = attachedIdSet.has(attr.id);
                const isChecked = selectedAttributeIds.includes(attr.id);

                return (
                  <div
                    key={attr.id}
                    onClick={() => {
                      if (isAlreadyAttached) return;
                      setSelectedAttributeIds((prev) =>
                        isChecked ? prev.filter((id) => id !== attr.id) : [...prev, attr.id]
                      );
                    }}
                    className={`p-3 flex items-start gap-3 transition-colors ${
                      isAlreadyAttached
                        ? "bg-slate-50 opacity-60 cursor-not-allowed"
                        : isChecked
                        ? "bg-brand-orange-50/40 cursor-pointer"
                        : "hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isAlreadyAttached || isChecked}
                      disabled={isAlreadyAttached}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-300 text-brand-orange-600 focus:ring-brand-orange-500"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-admin-fg">
                          {attr.name}
                        </span>
                        {isAlreadyAttached ? (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            Already Attached
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              attr.isVariantDefining
                                ? "bg-violet-100 text-violet-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {attr.isVariantDefining ? "Variant" : "Info"}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-admin-fg-muted mt-0.5">
                        {attr.code} · {attr.inputType.replace("_", " ")}
                      </div>

                      {attr.previewValues && attr.previewValues.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-400">Options:</span>
                          <div className="flex flex-wrap gap-1">
                            {attr.previewValues.slice(0, 4).map((v: any) => (
                              <span
                                key={v.id}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-700"
                              >
                                {v.label}
                              </span>
                            ))}
                            {attr.valuesCount > 4 && (
                              <span className="text-[10px] text-slate-400">
                                +{attr.valuesCount - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>

      {/* Detach Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(detachTarget)}
        onClose={() => setDetachTarget(null)}
        title={`Remove '${detachTarget?.name}' from ${categoryName}?`}
        message={`This will remove '${detachTarget?.name}' from new product forms in this category. Any existing products that already have values for '${detachTarget?.name}' will retain their historical data.`}
        confirmLabel="Remove Attribute"
        variant="danger"
        isLoading={isDetaching}
        onConfirm={handleConfirmDetach}
      />
    </div>
  );
}
