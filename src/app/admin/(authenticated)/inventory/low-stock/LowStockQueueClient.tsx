"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Download,
  AlertTriangle,
  Package,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  SlidersHorizontal,
  Clock,
} from "lucide-react";
import { PageHeader, StatusBadge, useToast } from "@/components/admin/ui";
import { InventoryItemDTO, StockStatus } from "@/lib/inventory/types";
import AdjustStockDrawer, {
  AdjustStockDrawerItem,
} from "@/components/admin/inventory/AdjustStockDrawer";
import { updateVariantSettings } from "@/app/admin/(authenticated)/inventory/actions";
import { ReservedOrderInfo } from "@/components/admin/inventory/ReservedOrdersPopover";

interface LowStockQueueClientProps {
  items: InventoryItemDTO[];
  stats: {
    lowStockCount: number;
    outOfStockCount: number;
    totalNeedAction: number;
  };
  orderMap: Record<string, ReservedOrderInfo[]>;
}

export default function LowStockQueueClient({
  items: initialItems,
  stats,
  orderMap,
}: LowStockQueueClientProps) {
  const [items, setItems] = useState<InventoryItemDTO[]>(initialItems);
  const [segment, setSegment] = useState<"OUT_OF_STOCK" | "LOW_STOCK" | "ALL">(
    stats.outOfStockCount > 0 ? "OUT_OF_STOCK" : "ALL"
  );
  const [sortBy, setSortBy] = useState<"URGENCY" | "NAME" | "AVAILABLE">("URGENCY");

  const [activeAdjustItem, setActiveAdjustItem] = useState<AdjustStockDrawerItem | null>(null);
  const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false);

  const toast = useToast();

  const filteredAndSortedItems = useMemo(() => {
    let list = items.filter((item) => {
      if (segment === "OUT_OF_STOCK") return item.stockStatus === StockStatus.OUT_OF_STOCK;
      if (segment === "LOW_STOCK") return item.stockStatus === StockStatus.LOW_STOCK;
      return true;
    });

    if (sortBy === "URGENCY") {
      // Urgency: available asc, then pending orders count desc
      list.sort((a, b) => {
        if (a.available !== b.available) return a.available - b.available;
        const aOrders = orderMap[a.variantId]?.length || 0;
        const bOrders = orderMap[b.variantId]?.length || 0;
        return bOrders - aOrders;
      });
    } else if (sortBy === "NAME") {
      list.sort((a, b) => a.productTitle.localeCompare(b.productTitle));
    } else if (sortBy === "AVAILABLE") {
      list.sort((a, b) => a.available - b.available);
    }

    return list;
  }, [items, segment, sortBy, orderMap]);

  async function handleSetThreshold(item: InventoryItemDTO) {
    const val = prompt(
      `Set new threshold for ${item.productTitle} (${item.variantTitle || "Default"}):`,
      item.lowStockThreshold.toString()
    );
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        const res = await updateVariantSettings(item.variantId, {
          lowStockThreshold: parsed,
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) =>
              i.variantId === item.variantId ? { ...i, lowStockThreshold: parsed } : i
            )
          );
          toast.success("Threshold Updated", `Set threshold to ${parsed} units.`);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <PageHeader
        title="Low Stock Queue"
        subtitle={`${stats.lowStockCount} running low · ${stats.outOfStockCount} out of stock`}
        primaryAction={{
          label: "Export Reorder List",
          icon: Download,
          onClick: () => {
            window.location.href = "/api/admin/inventory/export?type=reorder";
          },
        }}
      />

      {/* SEGMENTED BUTTONS & SORT CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSegment("OUT_OF_STOCK")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              segment === "OUT_OF_STOCK"
                ? "bg-rose-600 text-white"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <span>Out of stock</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-white">
              {stats.outOfStockCount}
            </span>
          </button>

          <button
            onClick={() => setSegment("LOW_STOCK")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              segment === "LOW_STOCK"
                ? "bg-amber-600 text-white"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <span>Running low</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-white">
              {stats.lowStockCount}
            </span>
          </button>

          <button
            onClick={() => setSegment("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              segment === "ALL"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-sunken)]"
            }`}
          >
            <span>All Need Action</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-800">
              {stats.totalNeedAction}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-fg-muted)] flex items-center gap-1">
            <SlidersHorizontal size={12} />
            <span>Sort:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none"
          >
            <option value="URGENCY">Urgency (Available asc + orders)</option>
            <option value="AVAILABLE">Lowest available units</option>
            <option value="NAME">Product name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* DECISION QUEUE LIST (CARDS) */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Nothing is running low. Every SKU is above its threshold.
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] max-w-sm mx-auto">
            Your stock levels are healthy. When variants hit their thresholds, they will appear here prioritized for replenishment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedItems.map((item) => {
            const pendingOrders = orderMap[item.variantId] || [];
            const suggestedReorder = Math.max(
              0,
              item.lowStockThreshold * 2 - item.available
            );

            return (
              <div
                key={item.variantId}
                className={`p-4 rounded-2xl border bg-[var(--color-surface)] shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between space-y-4 ${
                  item.stockStatus === StockStatus.OUT_OF_STOCK
                    ? "border-l-4 border-l-rose-500 border-[var(--color-border)]"
                    : "border-l-4 border-l-amber-500 border-[var(--color-border)]"
                }`}
              >
                {/* Top: Info & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-fg)] line-clamp-1">
                        {item.productTitle}
                      </h4>
                      <p className="text-[11px] text-[var(--color-fg-muted)]">
                        {item.variantTitle || "Default"} · {item.categoryName}
                      </p>
                      <p className="text-[11px] font-mono text-[var(--color-fg-muted)] mt-0.5">
                        SKU: {item.sku || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {item.stockStatus === StockStatus.OUT_OF_STOCK ? (
                      <StatusBadge status="DANGER" label="Out of Stock" />
                    ) : (
                      <StatusBadge status="WARNING" label="Low Stock" />
                    )}
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[var(--color-surface-sunken)] text-center text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--color-fg-muted)] block">
                      Available
                    </span>
                    <span
                      className={`font-mono text-sm font-extrabold ${
                        item.available === 0 ? "text-rose-600" : "text-amber-600"
                      }`}
                    >
                      {item.available}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--color-fg-muted)] block">
                      Threshold
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--color-fg)]">
                      {item.lowStockThreshold}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--color-fg-muted)] block">
                      Suggest Reorder
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +{suggestedReorder}
                    </span>
                  </div>
                </div>

                {/* Highest-value element: Pending orders impact */}
                {pendingOrders.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span>
                        ⚠️ {pendingOrders.length} pending order{pendingOrders.length > 1 ? "s" : ""} need this SKU
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold">
                      {pendingOrders.reduce((s, o) => s + o.quantity, 0)} units total
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetThreshold(item)}
                      className="text-xs font-semibold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:underline"
                    >
                      Set threshold
                    </button>
                    <span>·</span>
                    <Link
                      href={`/products/${item.productId}`}
                      target="_blank"
                      className="text-xs font-semibold text-[var(--color-fg-muted)] hover:text-[var(--color-primary)] inline-flex items-center gap-0.5"
                    >
                      <span>Storefront</span>
                      <ExternalLink size={10} />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveAdjustItem(item);
                      setAdjustDrawerOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors shadow-xs cursor-pointer"
                  >
                    Adjust Stock
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* S2 ADJUST STOCK DRAWER OVER QUEUE */}
      <AdjustStockDrawer
        isOpen={adjustDrawerOpen}
        onClose={() => {
          setAdjustDrawerOpen(false);
          setActiveAdjustItem(null);
        }}
        item={activeAdjustItem}
        defaultDirection="ADD"
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
