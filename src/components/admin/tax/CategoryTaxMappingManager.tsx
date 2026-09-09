"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderTree,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Check,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  ArrowRight,
} from "lucide-react";
import {
  PageHeader,
  BulkActionBar,
  Modal,
  SearchableSelect,
  SelectOption,
  useToast,
  EmptyState,
} from "@/components/admin/ui";
import {
  mapCategoryHsnAction,
  bulkMapCategoryHsnAction,
  removeCategoryHsnMappingAction,
} from "@/app/admin/(authenticated)/tax/actions";

export interface CategoryMappingNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName?: string | null;
  isSubcategory: boolean;
  hsnId: string | null;
  hsnCode: string | null;
  hsnDescription: string | null;
  rateDisplay: string;
  source: "Direct" | "Inherited" | "Override" | "Missing";
  hasDirectMapping: boolean;
  children: CategoryMappingNode[];
}

export interface HsnOption {
  id: string;
  code: string;
  description: string;
  rateDisplay: string;
}

export default function CategoryTaxMappingManager({
  tree,
  flat,
  hsns,
  mappedCount: initialMappedCount,
  unmappedCount: initialUnmappedCount,
}: {
  tree: CategoryMappingNode[];
  flat: CategoryMappingNode[];
  hsns: HsnOption[];
  mappedCount: number;
  unmappedCount: number;
}) {
  // Default filter to "UNMAPPED" if unmapped categories exist per PRD S5
  const [activeFilter, setActiveFilter] = useState<"ALL" | "MAPPED" | "UNMAPPED">(() =>
    initialUnmappedCount > 0 ? "UNMAPPED" : "ALL"
  );
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(tree.map((t) => t.id))
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Mapping modal states
  const [mappingCategory, setMappingCategory] = useState<CategoryMappingNode | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedHsnId, setSelectedHsnId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  const hsnSelectOptions: SelectOption[] = useMemo(
    () =>
      hsns.map((h) => ({
        value: h.id,
        label: `${h.code} — ${h.description}`,
        description: `${h.rateDisplay} GST`,
      })),
    [hsns]
  );

  const selectedHsnObj = useMemo(
    () => hsns.find((h) => h.id === selectedHsnId),
    [hsns, selectedHsnId]
  );

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Row selection
  function handleSelectRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectAll(items: CategoryMappingNode[]) {
    const itemIds = items.map((i) => i.id);
    const allSelected = itemIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...itemIds])));
    }
  }

  // Filter categories
  const filteredFlat = useMemo(() => {
    return flat.filter((cat) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          cat.name.toLowerCase().includes(q) ||
          (cat.hsnCode && cat.hsnCode.includes(q)) ||
          (cat.hsnDescription && cat.hsnDescription.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (activeFilter === "MAPPED" && cat.source === "Missing") return false;
      if (activeFilter === "UNMAPPED" && cat.source !== "Missing") return false;
      return true;
    });
  }, [flat, search, activeFilter]);

  const currentMappedCount = useMemo(
    () => flat.filter((c) => c.source !== "Missing").length,
    [flat]
  );
  const currentUnmappedCount = useMemo(
    () => flat.filter((c) => c.source === "Missing").length,
    [flat]
  );

  async function handleSaveSingleMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mappingCategory || !selectedHsnId) return;

    setIsSaving(true);
    try {
      const res = await mapCategoryHsnAction(mappingCategory.id, selectedHsnId);
      if (res.ok) {
        toast.success(
          "Category Mapped",
          `'${mappingCategory.name}' mapped to HSN successfully.`
        );
        setMappingCategory(null);
        setSelectedHsnId("");
        window.location.reload();
      } else {
        toast.error("Mapping Failed", res.error);
      }
    } catch (err: any) {
      toast.error("Mapping Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveBulkMapping(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0 || !selectedHsnId) return;

    setIsSaving(true);
    try {
      const res = await bulkMapCategoryHsnAction(selectedIds, selectedHsnId);
      if (res.ok) {
        toast.success(
          "Bulk Mapping Saved",
          `${selectedIds.length} categories mapped to HSN ${res.hsnCode}`
        );
        setIsBulkModalOpen(false);
        setSelectedIds([]);
        setSelectedHsnId("");
        window.location.reload();
      } else {
        toast.error("Bulk Mapping Failed", res.error);
      }
    } catch (err: any) {
      toast.error("Bulk Mapping Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveOverride(categoryId: string, categoryName: string) {
    try {
      const res = await removeCategoryHsnMappingAction(categoryId);
      if (res.ok) {
        toast.success(
          "Override Removed",
          `'${categoryName}' now inherits parent HSN mapping.`
        );
        window.location.reload();
      }
    } catch (err: any) {
      toast.error("Failed to remove override", err.message);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Category Tax Mapping"
        subtitle={`${currentMappedCount} of ${flat.length} categories mapped`}
        overflowActions={[
          {
            label: "Export Mapping",
            icon: Download,
            onClick: () => window.open("/api/admin/tax/mapping/export", "_blank"),
          },
        ]}
      />

      {/* FILTER STRIP & SEARCH */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1.5 rounded-[var(--radius-full)] text-[var(--text-xs)] font-medium transition-all ${
              activeFilter === "ALL"
                ? "bg-[var(--blue-600)] text-white font-bold"
                : "bg-[var(--gray-100)] text-[var(--gray-700)] hover:bg-[var(--gray-200)]"
            }`}
          >
            All ({flat.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("MAPPED")}
            className={`px-3 py-1.5 rounded-[var(--radius-full)] text-[var(--text-xs)] font-medium transition-all ${
              activeFilter === "MAPPED"
                ? "bg-[var(--blue-600)] text-white font-bold"
                : "bg-[var(--gray-100)] text-[var(--gray-700)] hover:bg-[var(--gray-200)]"
            }`}
          >
            Mapped ({currentMappedCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("UNMAPPED")}
            className={`px-3 py-1.5 rounded-[var(--radius-full)] text-[var(--text-xs)] font-medium transition-all flex items-center gap-1 ${
              activeFilter === "UNMAPPED"
                ? "bg-[var(--amber-600)] text-white font-bold"
                : "bg-[var(--amber-100)] text-[var(--amber-900)] hover:bg-[var(--amber-200)]"
            }`}
          >
            {currentUnmappedCount > 0 && <AlertTriangle size={12} />}
            Unmapped ({currentUnmappedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category or HSN..."
            className="w-full pl-9 pr-3 py-1.5 text-[var(--text-sm)] bg-[var(--gray-50)] border border-[var(--gray-300)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-500)]"
          />
        </div>
      </div>

      {/* TREE TABLE */}
      {hsns.length === 0 ? (
        <EmptyState
          title="No HSN codes defined yet"
          description="Add tax codes before mapping categories."
          actionLabel="Add HSN Code"
          onAction={() => window.location.assign("/admin/tax/hsn")}
        />
      ) : (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--gray-200)] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-[var(--text-sm)]">
            <thead className="bg-[var(--gray-50)] text-[11px] font-bold uppercase tracking-wider text-[var(--gray-500)] border-b border-[var(--gray-200)]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(filteredFlat)}
                    className="flex items-center text-[var(--gray-400)] hover:text-[var(--gray-600)]"
                  >
                    {filteredFlat.length > 0 &&
                    filteredFlat.every((i) => selectedIds.includes(i.id)) ? (
                      <CheckSquare size={16} className="text-[var(--blue-600)]" />
                    ) : filteredFlat.some((i) => selectedIds.includes(i.id)) ? (
                      <MinusSquare size={16} className="text-[var(--blue-600)]" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">HSN Code</th>
                <th className="px-4 py-3">GST Rate</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-200)]">
              {filteredFlat.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--gray-500)]">
                    No categories match the active filter.
                  </td>
                </tr>
              ) : activeFilter === "ALL" && !search ? (
                // Render hierarchical tree when viewing ALL without search
                tree.map((parent) => (
                  <React.Fragment key={parent.id}>
                    <CategoryRow
                      node={parent}
                      isExpanded={expandedIds.has(parent.id)}
                      onToggleExpand={() => toggleExpand(parent.id)}
                      isSelected={selectedIds.includes(parent.id)}
                      onSelect={() => handleSelectRow(parent.id)}
                      onOpenMap={() => {
                        setMappingCategory(parent);
                        setSelectedHsnId(parent.hsnId || "");
                      }}
                      onRemoveOverride={() => handleRemoveOverride(parent.id, parent.name)}
                    />
                    {expandedIds.has(parent.id) &&
                      parent.children.map((child) => (
                        <CategoryRow
                          key={child.id}
                          node={child}
                          isExpanded={false}
                          isSelected={selectedIds.includes(child.id)}
                          onSelect={() => handleSelectRow(child.id)}
                          onOpenMap={() => {
                            setMappingCategory(child);
                            setSelectedHsnId(child.hsnId || "");
                          }}
                          onRemoveOverride={() => handleRemoveOverride(child.id, child.name)}
                        />
                      ))}
                  </React.Fragment>
                ))
              ) : (
                // Render flat filtered rows
                filteredFlat.map((item) => (
                  <CategoryRow
                    key={item.id}
                    node={item}
                    isExpanded={false}
                    isSelected={selectedIds.includes(item.id)}
                    onSelect={() => handleSelectRow(item.id)}
                    onOpenMap={() => {
                      setMappingCategory(item);
                      setSelectedHsnId(item.hsnId || "");
                    }}
                    onRemoveOverride={() => handleRemoveOverride(item.id, item.name)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: "Map to HSN",
            onClick: () => {
              setSelectedHsnId("");
              setIsBulkModalOpen(true);
            },
          },
        ]}
      />

      {/* MAP HSN MODAL (480px) */}
      <Modal
        isOpen={Boolean(mappingCategory)}
        onClose={() => {
          setMappingCategory(null);
          setSelectedHsnId("");
        }}
        title={`Map HSN for ${mappingCategory?.name || ""}`}
        className="max-w-[480px]"
      >
        <form onSubmit={handleSaveSingleMapping} className="space-y-4 pt-2">
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Select HSN Code <span className="text-[var(--red-500)]">*</span>
            </label>
            <SearchableSelect
              options={hsnSelectOptions}
              value={selectedHsnId}
              onChange={(val) => setSelectedHsnId(val as string)}
              placeholder="Search HSN code or description..."
            />
          </div>

          {/* Live rate preview strip */}
          {selectedHsnObj ? (
            <div className="p-3 bg-[var(--blue-50)] border border-[var(--blue-200)] rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--blue-900)] space-y-1">
              <span className="font-bold block">Tax Preview:</span>
              <p>
                Products in this category will be taxed at{" "}
                <span className="font-bold">{selectedHsnObj.rateDisplay} GST</span>.
              </p>
              <p className="text-[11px] text-[var(--blue-700)]">
                {selectedHsnObj.code} — {selectedHsnObj.description}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--gray-500)]">
              Choose an HSN code to preview the tax rate applied to products.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--gray-200)]">
            <button
              type="button"
              onClick={() => {
                setMappingCategory(null);
                setSelectedHsnId("");
              }}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedHsnId || isSaving}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Map HSN Code"}
            </button>
          </div>
        </form>
      </Modal>

      {/* BULK MAP MODAL */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setSelectedHsnId("");
        }}
        title={`Map ${selectedIds.length} Categories to HSN`}
        className="max-w-[480px]"
      >
        <form onSubmit={handleSaveBulkMapping} className="space-y-4 pt-2">
          <div>
            <label className="block text-[var(--text-xs)] font-bold text-[var(--gray-700)] uppercase tracking-wider mb-1.5">
              Select HSN Code to Apply <span className="text-[var(--red-500)]">*</span>
            </label>
            <SearchableSelect
              options={hsnSelectOptions}
              value={selectedHsnId}
              onChange={(val) => setSelectedHsnId(val as string)}
              placeholder="Search HSN code..."
            />
          </div>

          {selectedHsnObj && (
            <div className="p-3 bg-[var(--blue-50)] border border-[var(--blue-200)] rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--blue-900)]">
              All {selectedIds.length} selected categories will be mapped to{" "}
              <span className="font-bold">
                {selectedHsnObj.code} ({selectedHsnObj.rateDisplay} GST)
              </span>
              .
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--gray-200)]">
            <button
              type="button"
              onClick={() => {
                setIsBulkModalOpen(false);
                setSelectedHsnId("");
              }}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-[var(--gray-700)] hover:bg-[var(--gray-100)] rounded-[var(--radius-md)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedHsnId || isSaving}
              className="px-4 py-2 text-[var(--text-sm)] font-medium text-white bg-[var(--blue-600)] hover:bg-[var(--blue-700)] rounded-[var(--radius-md)] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : `Map ${selectedIds.length} Categories`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CategoryRow({
  node,
  isExpanded,
  onToggleExpand,
  isSelected,
  onSelect,
  onOpenMap,
  onRemoveOverride,
}: {
  node: CategoryMappingNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onOpenMap: () => void;
  onRemoveOverride: () => void;
}) {
  const isUnmapped = node.source === "Missing";

  return (
    <tr
      className={`transition-colors ${
        isUnmapped
          ? "border-l-4 border-l-[var(--amber-500)] bg-[var(--amber-50)]/40 hover:bg-[var(--amber-50)]"
          : isSelected
          ? "bg-[var(--blue-50)]/50"
          : "hover:bg-[var(--gray-50)]"
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-4 py-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center text-[var(--gray-400)] hover:text-[var(--gray-600)]"
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-[var(--blue-600)]" />
          ) : (
            <Square size={16} />
          )}
        </button>
      </td>

      {/* Category Name */}
      <td className="px-4 py-3">
        <div
          className={`flex items-center gap-2 ${
            node.isSubcategory ? "pl-6 text-[var(--gray-700)]" : "font-semibold text-[var(--gray-900)]"
          }`}
        >
          {!node.isSubcategory && node.children && node.children.length > 0 ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[var(--gray-400)] hover:text-[var(--gray-700)]"
            >
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : !node.isSubcategory ? (
            <span className="w-4" />
          ) : (
            <span className="text-[var(--gray-300)]">—</span>
          )}

          <span className="truncate">{node.name}</span>

          {node.isSubcategory && node.parentName && (
            <span className="text-[10px] text-[var(--gray-400)]">
              in {node.parentName}
            </span>
          )}
        </div>
      </td>

      {/* HSN Code */}
      <td className="px-4 py-3">
        {node.hsnCode ? (
          <code className="font-mono font-bold text-[var(--text-xs)] text-[var(--blue-700)] bg-[var(--gray-100)] px-1.5 py-0.5 rounded">
            {node.hsnCode}
          </code>
        ) : (
          <span className="text-[var(--gray-400)] text-[var(--text-xs)] italic">
            — not set —
          </span>
        )}
      </td>

      {/* GST Rate */}
      <td className="px-4 py-3">
        {node.rateDisplay !== "—" ? (
          <span className="font-medium text-[var(--gray-900)]">{node.rateDisplay}</span>
        ) : (
          <span className="text-[var(--gray-400)]">—</span>
        )}
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        {node.source === "Missing" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--amber-700)] bg-[var(--amber-100)] px-2 py-0.5 rounded-full border border-[var(--amber-300)]">
            <AlertTriangle size={11} /> Missing
          </span>
        ) : node.source === "Override" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--violet-700)] bg-[var(--violet-50)] px-2 py-0.5 rounded-full border border-[var(--violet-200)]">
            Override
          </span>
        ) : node.source === "Inherited" ? (
          <span className="text-[11px] text-[var(--gray-500)] italic">
            Inherited
          </span>
        ) : (
          <span className="text-[11px] text-[var(--gray-700)] font-medium">
            Direct
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {node.source === "Missing" ? (
          <button
            type="button"
            onClick={onOpenMap}
            className="px-3 py-1 bg-[var(--blue-600)] hover:bg-[var(--blue-700)] text-white text-[var(--text-xs)] font-bold rounded-[var(--radius-md)] shadow-sm transition-colors"
          >
            Map HSN
          </button>
        ) : node.source === "Inherited" ? (
          <button
            type="button"
            onClick={onOpenMap}
            className="text-[var(--text-xs)] font-medium text-[var(--blue-600)] hover:underline"
          >
            Override
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onOpenMap}
              className="text-[var(--text-xs)] font-medium text-[var(--blue-600)] hover:underline"
            >
              Change
            </button>
            {node.isSubcategory && node.hasDirectMapping && (
              <button
                type="button"
                onClick={onRemoveOverride}
                className="text-[var(--text-xs)] text-[var(--gray-400)] hover:text-[var(--red-600)] hover:underline"
                title="Remove override to inherit from parent"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
