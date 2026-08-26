"use client";

import React, { useState } from "react";
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Save,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import {
  DataTable,
  ColumnDef,
  PageHeader,
  StatusBadge,
  BulkActionBar,
  useToast,
} from "@/components/admin/ui";
import { formatINR } from "@/lib/utils";
import { updateVariantStock, bulkUpdateStock } from "@/app/admin/(authenticated)/inventory/actions";

export interface VariantInventoryItem {
  id: string;
  sku: string | null;
  title: string | null;
  stock: number;
  price: number | null;
  isAvailable: boolean;
  productId: string;
  productTitle: string;
  productStockMode: string;
  categoryName: string;
}

export default function InventoryManager({
  inventory,
}: {
  inventory: VariantInventoryItem[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkStockVal, setBulkStockVal] = useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const toast = useToast();

  function handleStockChange(variantId: string, val: number) {
    setStockEdits((prev) => ({
      ...prev,
      [variantId]: Math.max(0, val),
    }));
  }

  async function handleSaveRow(variant: VariantInventoryItem) {
    const newStock = stockEdits[variant.id] ?? variant.stock;
    setSavingId(variant.id);
    try {
      const res = await updateVariantStock(variant.id, newStock);
      if (res.ok) {
        toast.success("Stock Updated", `${variant.productTitle} set to ${newStock} units.`);
        setStockEdits((prev) => {
          const next = { ...prev };
          delete next[variant.id];
          return next;
        });
      } else {
        toast.error(res.error || "Failed to update stock");
      }
    } catch (_) {
      toast.error("Failed to update stock");
    } finally {
      setSavingId(null);
    }
  }

  async function handleBulkApply() {
    const parsed = parseInt(bulkStockVal, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Please enter a valid non-negative number.");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const res = await bulkUpdateStock(selectedIds, parsed);
      if (res.ok) {
        toast.success("Bulk Updated", `Updated ${selectedIds.length} items to ${parsed} units.`);
        setSelectedIds([]);
        setBulkStockVal("");
      } else {
        toast.error(res.error || "Failed bulk update");
      }
    } catch (_) {
      toast.error("Failed bulk update");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  const columns: ColumnDef<VariantInventoryItem>[] = [
    {
      id: "product",
      header: "Product & Variant",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-[var(--color-fg)] line-clamp-1">{row.productTitle}</p>
          <div className="flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-fg-muted)] font-mono">
            <span>{row.title ? row.title : "Default"}</span>
            {row.sku && <span>· SKU: {row.sku}</span>}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (row) => (
        <span className="text-[var(--text-xs)] font-medium text-[var(--color-fg-muted)]">
          {row.categoryName}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => {
        const currentStock = stockEdits[row.id] ?? row.stock;
        if (currentStock === 0) {
          return <StatusBadge status="DANGER" label="Out of Stock" />;
        }
        if (currentStock <= 10) {
          return <StatusBadge status="WARNING" label={`Low Stock (${currentStock})`} />;
        }
        return <StatusBadge status="SUCCESS" label="In Stock" />;
      },
    },
    {
      id: "stockEdit",
      header: "Live Stock Level",
      align: "center",
      cell: (row) => {
        const currentVal = stockEdits[row.id] ?? row.stock;
        const isDirty = stockEdits[row.id] !== undefined && stockEdits[row.id] !== row.stock;
        const isSaving = savingId === row.id;

        return (
          <div
            className="inline-flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleStockChange(row.id, currentVal - 1)}
              className="w-7 h-7 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-fg-muted)] active:scale-95"
            >
              <Minus size={13} />
            </button>

            <input
              type="number"
              min="0"
              value={currentVal}
              onChange={(e) => handleStockChange(row.id, parseInt(e.target.value, 10) || 0)}
              className={`w-16 h-7 text-center font-mono font-bold text-[var(--text-xs)] rounded border ${
                isDirty
                  ? "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] bg-orange-50/50"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              } focus:outline-none`}
            />

            <button
              type="button"
              onClick={() => handleStockChange(row.id, currentVal + 1)}
              className="w-7 h-7 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-fg-muted)] active:scale-95"
            >
              <Plus size={13} />
            </button>

            {isDirty && (
              <button
                type="button"
                onClick={() => handleSaveRow(row)}
                disabled={isSaving}
                className="h-7 px-2.5 rounded bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Save size={12} />
                <span>Save</span>
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <a
          href={`/products/${row.productId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-xs)] text-[var(--color-primary)] hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          View Storefront ↗
        </a>
      ),
    },
  ];

  const lowStockCount = inventory.filter((i) => i.stock <= 10).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock & Inventory Control"
        subtitle="Live multi-variant stock levels and instant batch synchronization"
        countBadge={`${inventory.length} SKUs`}
        secondaryAction={{
          label: "Export Inventory CSV",
          icon: FileSpreadsheet,
          onClick: () => {
            window.location.href = "/api/admin/export?type=inventory";
          },
        }}
      />

      {lowStockCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                {lowStockCount} products are low on stock (≤10 units)
              </p>
              <p className="text-[11px] text-amber-700">
                Replenish inventory to avoid fulfillment delays in Suriyawan dispatch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Bulk Inventory DataTable */}
      <DataTable
        tableId="admin_inventory_table"
        columns={columns}
        data={inventory}
        keyExtractor={(item) => item.id}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={[
          {
            label: "Batch Set Stock",
            onClick: () => {
              const val = prompt(
                `Enter new stock count to apply to ${selectedIds.length} selected items:`
              );
              if (val !== null) {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                  bulkUpdateStock(selectedIds, parsed).then(() => {
                    toast.success(
                      "Batch Updated",
                      `Updated ${selectedIds.length} items to ${parsed} units.`
                    );
                    setSelectedIds([]);
                  });
                }
              }
            },
          },
        ]}
        searchPlaceholder="Search products, variants, or SKUs…"
        emptyTitle="No inventory items found"
        emptyDescription="All tracked products and variants will appear here for real-time stock control."
      />
    </div>
  );
}
