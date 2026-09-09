"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Minus,
  Sliders,
  History,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  Package,
  Layers,
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  useToast,
} from "@/components/admin/ui";
import { InventoryItemDTO, StockStatus } from "@/lib/inventory/types";
import AdjustStockDrawer, {
  AdjustStockDrawerItem,
} from "./AdjustStockDrawer";
import StockHistoryDrawer, {
  StockHistoryItemProps,
} from "./StockHistoryDrawer";
import ReservedOrdersPopover, {
  ReservedOrderInfo,
} from "./ReservedOrdersPopover";
import { updateVariantSettings } from "@/app/admin/(authenticated)/inventory/actions";

interface StockOverviewProps {
  initialData: {
    items: InventoryItemDTO[];
    stats: {
      totalVariants: number;
      totalOnHand: number;
      totalReserved: number;
      totalAvailable: number;
      lowStockCount: number;
      outOfStockCount: number;
      alertMessage: string | null;
    };
    categories: Array<{ id: string; name: string }>;
    brands: Array<{ id: string; name: string }>;
    orderMap: Record<string, ReservedOrderInfo[]>;
  };
}

export default function StockOverview({ initialData }: StockOverviewProps) {
  const [items, setItems] = useState<InventoryItemDTO[]>(initialData.items);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [brandFilter, setBrandFilter] = useState<string>("ALL");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeAdjustItem, setActiveAdjustItem] = useState<AdjustStockDrawerItem | null>(null);
  const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false);
  const [adjustDefaultDirection, setAdjustDefaultDirection] = useState<"ADD" | "REMOVE">("ADD");

  const [activeHistoryItem, setActiveHistoryItem] = useState<StockHistoryItemProps | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdInputVal, setThresholdInputVal] = useState<number>(5);

  const toast = useToast();

  // Filter items in memory for responsive feel
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status tab
      if (statusTab !== "ALL" && item.stockStatus !== statusTab) return false;

      // Category filter
      if (categoryFilter !== "ALL" && item.categoryName !== categoryFilter) return false;

      // Brand filter
      if (brandFilter !== "ALL" && item.brandName !== brandFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = item.productTitle?.toLowerCase().includes(q);
        const variantMatch = item.variantTitle?.toLowerCase().includes(q);
        const skuMatch = item.sku?.toLowerCase().includes(q);
        if (!titleMatch && !variantMatch && !skuMatch) return false;
      }

      return true;
    });
  }, [items, statusTab, categoryFilter, brandFilter, searchQuery]);

  async function handleSaveThreshold(variantId: string, newThreshold: number) {
    try {
      const res = await updateVariantSettings(variantId, {
        lowStockThreshold: newThreshold,
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.variantId === variantId ? { ...i, lowStockThreshold: newThreshold } : i
          )
        );
        toast.success("Threshold Saved", `Low stock threshold set to ${newThreshold} units.`);
      } else {
        toast.error("Failed to update threshold");
      }
    } catch (_) {
      toast.error("Failed to update threshold");
    } finally {
      setEditingThresholdId(null);
    }
  }

  const columns: ColumnDef<InventoryItemDTO>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
            {row.imageUrl ? (
              <img
                src={row.imageUrl}
                alt={row.productTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package size={18} className="text-[var(--color-fg-muted)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-[var(--color-fg)] truncate max-w-[220px]">
              {row.productTitle}
            </p>
            <p className="text-[11px] text-[var(--color-fg-muted)] truncate">
              {row.variantTitle || "Default Variant"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "sku",
      header: "SKU",
      cell: (row) => (
        <span className="font-mono text-xs text-[var(--color-fg-muted)]">
          {row.sku || "—"}
        </span>
      ),
    },
    {
      id: "onHand",
      header: "On Hand",
      align: "right",
      cell: (row) => (
        <span className="font-mono text-xs text-[var(--color-fg)]">
          {row.onHand}
        </span>
      ),
    },
    {
      id: "reserved",
      header: "Reserved",
      align: "right",
      cell: (row) => {
        const orderList = initialData.orderMap[row.variantId] || [];
        return (
          <ReservedOrdersPopover
            count={row.reserved}
            orders={orderList}
            sku={row.sku}
            productTitle={row.productTitle}
          />
        );
      },
    },
    {
      id: "available",
      header: "Available",
      align: "right",
      cell: (row) => (
        <span
          className={`font-mono text-sm font-semibold ${
            row.available <= 0
              ? "text-rose-600 dark:text-rose-400 font-bold"
              : row.available <= row.lowStockThreshold
              ? "text-amber-600 dark:text-amber-400 font-bold"
              : "text-[var(--color-fg)] font-semibold"
          }`}
        >
          {row.available}
        </span>
      ),
    },
    {
      id: "threshold",
      header: "Threshold",
      align: "right",
      cell: (row) => {
        const isEditing = editingThresholdId === row.variantId;
        if (isEditing) {
          return (
            <input
              type="number"
              min="0"
              autoFocus
              value={thresholdInputVal}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setThresholdInputVal(parseInt(e.target.value, 10) || 0)}
              onBlur={() => handleSaveThreshold(row.variantId, thresholdInputVal)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveThreshold(row.variantId, thresholdInputVal);
                } else if (e.key === "Escape") {
                  setEditingThresholdId(null);
                }
              }}
              className="w-14 h-6 text-center font-mono text-xs rounded border border-[var(--color-primary)] bg-[var(--color-surface)] focus:outline-none"
            />
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingThresholdId(row.variantId);
              setThresholdInputVal(row.lowStockThreshold);
            }}
            className="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:underline cursor-pointer px-1 py-0.5 rounded"
            title="Click to change low stock threshold inline"
          >
            {row.lowStockThreshold}
          </button>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => {
        if (row.stockStatus === StockStatus.OUT_OF_STOCK) {
          return <StatusBadge status="DANGER" label="Out of Stock" />;
        }
        if (row.stockStatus === StockStatus.LOW_STOCK) {
          return <StatusBadge status="WARNING" label="Low Stock" />;
        }
        return <StatusBadge status="SUCCESS" label="In Stock" />;
      },
    },
    {
      id: "updatedAt",
      header: "Updated",
      cell: (row) => (
        <span className="text-[11px] text-[var(--color-fg-muted)]">
          {new Date(row.updatedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setActiveAdjustItem(row);
              setAdjustDefaultDirection("ADD");
              setAdjustDrawerOpen(true);
            }}
            className="px-2 py-1 text-xs font-semibold rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] transition-colors cursor-pointer"
          >
            Adjust
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveHistoryItem({
                variantId: row.variantId,
                productTitle: row.productTitle,
                variantTitle: row.variantTitle,
                sku: row.sku,
                onHand: row.onHand,
                reserved: row.reserved,
                available: row.available,
              });
              setHistoryDrawerOpen(true);
            }}
            className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            title="View Stock History Ledger"
          >
            <History size={15} />
          </button>

          <Link
            href={`/products/${row.productId}`}
            target="_blank"
            className="p-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            title="View Product on Storefront"
          >
            <ExternalLink size={15} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* PAGE HEADER */}
      <PageHeader
        title="Inventory"
        subtitle={`${initialData.stats.totalVariants} SKUs · ${initialData.stats.totalOnHand.toLocaleString()} units on hand`}
        primaryAction={{
          label: "Bulk Update",
          href: "/admin/inventory/bulk",
        }}
        secondaryAction={{
          label: "Export CSV",
          icon: FileSpreadsheet,
          onClick: () => {
            window.location.href = "/api/admin/inventory/export?type=inventory";
          },
        }}
      />

      {/* CONDITIONAL ALERT STRIP (TOP OF CONTENT) */}
      {initialData.stats.alertMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
            <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
              🔴 {initialData.stats.alertMessage}
            </p>
          </div>
          <Link
            href="/admin/inventory/low-stock"
            className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1 flex-shrink-0"
          >
            <span>Review low stock</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* 4 STAT TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusTab("ALL")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusTab === "ALL"
              ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 bg-[var(--color-surface)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--color-fg-muted)] block">
            On Hand
          </span>
          <span className="text-2xl font-mono font-bold text-[var(--color-fg)] block mt-1">
            {initialData.stats.totalOnHand.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--color-fg-muted)] block mt-0.5">
            physical units
          </span>
        </button>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left">
          <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--color-fg-muted)] block">
            Reserved
          </span>
          <span className="text-2xl font-mono font-bold text-amber-600 block mt-1">
            {initialData.stats.totalReserved.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--color-fg-muted)] block mt-0.5">
            committed to orders
          </span>
        </div>

        <button
          type="button"
          onClick={() => setStatusTab("IN_STOCK")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusTab === "IN_STOCK"
              ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 bg-[var(--color-surface)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--color-fg-muted)] block">
            Available
          </span>
          <span className="text-2xl font-mono font-extrabold text-[var(--color-primary)] block mt-1">
            {initialData.stats.totalAvailable.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--color-fg-muted)] block mt-0.5">
            sellable stock
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusTab(initialData.stats.outOfStockCount > 0 ? "OUT_OF_STOCK" : "LOW_STOCK")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusTab === "LOW_STOCK" || statusTab === "OUT_OF_STOCK"
              ? "border-rose-500 ring-2 ring-rose-500/20 bg-[var(--color-surface)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--color-fg-muted)] block">
            Low / Out
          </span>
          <span className="text-2xl font-mono font-bold text-rose-600 block mt-1">
            {initialData.stats.lowStockCount} / {initialData.stats.outOfStockCount}
          </span>
          <span className="text-[11px] text-[var(--color-fg-muted)] block mt-0.5">
            SKUs requiring action
          </span>
        </button>
      </div>

      {/* STATUS TABS & TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: "ALL", label: "All", count: initialData.stats.totalVariants },
              {
                key: "IN_STOCK",
                label: "In stock",
                count:
                  initialData.stats.totalVariants -
                  initialData.stats.lowStockCount -
                  initialData.stats.outOfStockCount,
              },
              { key: "LOW_STOCK", label: "Low", count: initialData.stats.lowStockCount },
              { key: "OUT_OF_STOCK", label: "Out", count: initialData.stats.outOfStockCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusTab === tab.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-fg)]"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-800">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar Filters */}
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {initialData.categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none"
          >
            <option value="ALL">All Brands</option>
            {initialData.brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DESKTOP DATA TABLE (With custom row left borders & click to adjust) */}
      <div className="hidden md:block">
        <DataTable
          tableId="stock_overview_table"
          columns={columns}
          data={filteredItems}
          keyExtractor={(item) => item.variantId}
          selectable={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          searchPlaceholder="Search product name or SKU…"
          onRowClick={(row) => {
            setActiveAdjustItem(row);
            setAdjustDefaultDirection("ADD");
            setAdjustDrawerOpen(true);
          }}
          bulkActions={[
            {
              label: "Adjust Stock",
              onClick: () => {
                if (selectedIds.length === 1) {
                  const target = items.find((i) => i.variantId === selectedIds[0]);
                  if (target) {
                    setActiveAdjustItem(target);
                    setAdjustDrawerOpen(true);
                  }
                } else {
                  window.location.href = `/admin/inventory/bulk?ids=${selectedIds.join(",")}`;
                }
              },
            },
            {
              label: "Set Threshold",
              onClick: () => {
                const val = prompt(
                  `Enter new low-stock threshold for ${selectedIds.length} selected SKUs:`
                );
                if (val !== null) {
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed) && parsed >= 0) {
                    Promise.all(
                      selectedIds.map((id) =>
                        updateVariantSettings(id, { lowStockThreshold: parsed })
                      )
                    ).then(() => {
                      setItems((prev) =>
                        prev.map((i) =>
                          selectedIds.includes(i.variantId)
                            ? { ...i, lowStockThreshold: parsed }
                            : i
                        )
                      );
                      toast.success(
                        "Threshold Updated",
                        `Updated ${selectedIds.length} SKUs to threshold ${parsed}.`
                      );
                      setSelectedIds([]);
                    });
                  }
                }
              },
            },
          ]}
          emptyTitle={
            statusTab === "OUT_OF_STOCK"
              ? "Nothing is out of stock. Good."
              : "No inventory items match your filter"
          }
          emptyDescription="All active variants are synced with the immutable stock ledger."
        />
      </div>

      {/* MOBILE WAREHOUSE CARD STACK (<768px) */}
      <div className="md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-fg-muted)]">
            No inventory items found.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.variantId}
              className={`p-3.5 rounded-xl border bg-[var(--color-surface)] shadow-xs space-y-2.5 ${
                item.stockStatus === StockStatus.OUT_OF_STOCK
                  ? "border-l-4 border-rose-500"
                  : item.stockStatus === StockStatus.LOW_STOCK
                  ? "border-l-4 border-amber-500"
                  : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={20} className="text-[var(--color-fg-muted)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--color-fg)] truncate">
                    {item.productTitle} · {item.variantTitle || "Default"}
                  </p>
                  <p className="text-[11px] font-mono text-[var(--color-fg-muted)] mt-0.5">
                    {item.sku || "No SKU"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-bold text-[var(--color-primary)]">
                      Available: {item.available}
                    </span>
                    {item.stockStatus === StockStatus.LOW_STOCK && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Low stock
                      </span>
                    )}
                    {item.stockStatus === StockStatus.OUT_OF_STOCK && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-fg-muted)] font-mono mt-0.5">
                    On hand {item.onHand} · Reserved {item.reserved}
                  </p>
                </div>
              </div>

              {/* Direct Touch Targets >= 44px for warehouse floor */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-border)]/60">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdjustItem(item);
                    setAdjustDefaultDirection("REMOVE");
                    setAdjustDrawerOpen(true);
                  }}
                  className="min-h-[44px] rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
                >
                  <Minus size={14} />
                  <span>− Remove</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdjustItem(item);
                    setAdjustDefaultDirection("ADD");
                    setAdjustDrawerOpen(true);
                  }}
                  className="min-h-[44px] rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
                >
                  <Plus size={14} />
                  <span>+ Add</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* S2 ADJUST DRAWER */}
      <AdjustStockDrawer
        isOpen={adjustDrawerOpen}
        onClose={() => {
          setAdjustDrawerOpen(false);
          setActiveAdjustItem(null);
        }}
        item={activeAdjustItem}
        defaultDirection={adjustDefaultDirection}
        onSuccess={() => {
          // Refresh data or reload page
          window.location.reload();
        }}
      />

      {/* S3 HISTORY DRAWER */}
      <StockHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => {
          setHistoryDrawerOpen(false);
          setActiveHistoryItem(null);
        }}
        item={activeHistoryItem}
      />
    </div>
  );
}
