"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Download,
  ExternalLink,
  Bot,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Clock,
} from "lucide-react";
import { Drawer, StatusBadge, useToast } from "@/components/admin/ui";
import Link from "next/link";

export interface StockHistoryItemProps {
  variantId: string;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  onHand: number;
  reserved: number;
  available: number;
}

interface StockHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockHistoryItemProps | null;
}

export default function StockHistoryDrawer({
  isOpen,
  onClose,
  item,
}: StockHistoryDrawerProps) {
  const [filterType, setFilterType] = useState<"ALL" | "ADJUSTMENT" | "ORDER" | "RETURN">("ALL");
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (isOpen && item) {
      loadMovements(item.variantId);
    }
  }, [isOpen, item]);

  async function loadMovements(variantId: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/${variantId}/movements?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setMovements(json.movements || []);
      } else {
        toast.error("Failed to load movement ledger");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load movements");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredMovements = movements.filter((m) => {
    if (filterType === "ALL") return true;
    if (filterType === "ADJUSTMENT") return m.movementType === "ADJUSTMENT";
    if (filterType === "ORDER")
      return m.movementType === "RESERVATION" || m.movementType === "FULFILMENT" || m.movementType === "RELEASE";
    if (filterType === "RETURN") return m.movementType === "RETURN";
    return true;
  });

  if (!item) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Ledger & History"
      subtitle={`${item.productTitle} ${
        item.variantTitle ? `· ${item.variantTitle}` : ""
      } ${item.sku ? `(${item.sku})` : ""}`}
      width="wide"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-[var(--color-fg-muted)]">
            Showing {filteredMovements.length} ledger movements
          </span>
          <button
            type="button"
            onClick={() => {
              window.location.href = `/api/admin/inventory/export?type=movements&variantId=${item.variantId}`;
            }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>Export History CSV</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* CURRENT POSITION BANNER */}
        <div className="p-3 bg-[var(--color-surface-sunken)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
          <div className="text-xs">
            <span className="text-[var(--color-fg-muted)]">Current Position: </span>
            <span className="font-semibold text-[var(--color-fg)]">
              On hand <strong className="font-mono">{item.onHand}</strong> · Reserved{" "}
              <strong className="font-mono text-amber-600">{item.reserved}</strong> · Available{" "}
              <strong className="font-mono text-[var(--color-primary)]">{item.available}</strong>
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)]">
            Immutable Record
          </span>
        </div>

        {/* FILTER TABS */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
          <div className="flex items-center gap-1">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "ADJUSTMENT", label: "Adjustments" },
                { key: "ORDER", label: "Orders" },
                { key: "RETURN", label: "Returns" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  filterType === tab.key
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TIMELINE LEDGER LIST */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--color-fg-muted)]">
              Loading immutable ledger records…
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-fg-muted)]">
              No stock movements recorded in this filter view.
            </div>
          ) : (
            filteredMovements.map((mov) => {
              const isPositive = mov.quantityDelta > 0;
              const isSystem =
                mov.createdBy === "System" ||
                mov.movementType === "RESERVATION" ||
                mov.movementType === "FULFILMENT";

              return (
                <div
                  key={mov.id}
                  className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {/* Reason badge */}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {mov.reasonCode}
                      </span>
                      <span className="text-xs font-semibold text-[var(--color-fg)]">
                        {mov.movementType}
                      </span>
                    </div>

                    <div className="text-right">
                      {/* Signed delta */}
                      <span
                        className={`font-mono text-sm font-bold flex items-center justify-end gap-0.5 ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        <span>
                          {isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-fg-muted)] block">
                        on hand {mov.onHandAfter}
                      </span>
                    </div>
                  </div>

                  {/* Note & Reference */}
                  {(mov.note || mov.referenceId) && (
                    <p className="text-xs text-[var(--color-fg-muted)] italic">
                      "{mov.note || `${mov.referenceType}: ${mov.referenceId}`}"
                    </p>
                  )}

                  {/* Footer with Actor & Timestamp */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] pt-1 border-t border-[var(--color-border)]/40">
                    <div className="flex items-center gap-1.5">
                      {isSystem ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                          <Bot size={12} />
                          <span>System</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
                          <User size={12} />
                          <span>{mov.createdBy || "Admin"}</span>
                        </span>
                      )}

                      {mov.referenceType === "ORDER" && mov.referenceId && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/admin/orders/${mov.referenceId}`}
                            className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5 font-mono"
                            target="_blank"
                          >
                            <span>Order #{mov.referenceId.slice(0, 8)}…</span>
                            <ExternalLink size={10} />
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 font-mono">
                      <Clock size={11} />
                      <span>
                        {new Date(mov.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
}
