"use client";

import React, { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  User,
  ExternalLink,
  Clock,
  Filter,
} from "lucide-react";
import { PageHeader, DataTable, ColumnDef } from "@/components/admin/ui";
import Link from "next/link";

interface MovementRow {
  id: string;
  sku: string;
  productTitle: string;
  variantTitle: string | null;
  movementType: string;
  reasonCode: string;
  quantityDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

interface MovementsLedgerClientProps {
  initialMovements: MovementRow[];
}

export default function MovementsLedgerClient({
  initialMovements,
}: MovementsLedgerClientProps) {
  const [movements] = useState<MovementRow[]>(initialMovements);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.movementType !== typeFilter) return false;
      if (reasonFilter !== "ALL" && m.reasonCode !== reasonFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const skuMatch = m.sku.toLowerCase().includes(q);
        const titleMatch = m.productTitle.toLowerCase().includes(q);
        const actorMatch = m.createdBy.toLowerCase().includes(q);
        if (!skuMatch && !titleMatch && !actorMatch) return false;
      }
      return true;
    });
  }, [movements, typeFilter, reasonFilter, search]);

  const columns: ColumnDef<MovementRow>[] = [
    {
      id: "timestamp",
      header: "Date / Time",
      cell: (row) => (
        <div className="font-mono text-[11px] text-[var(--color-fg-muted)] space-y-0.5 whitespace-nowrap">
          <p className="font-semibold text-[var(--color-fg)]">
            {new Date(row.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p>
            {new Date(row.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      id: "product",
      header: "SKU & Product",
      cell: (row) => (
        <div className="min-w-0 py-1">
          <p className="font-mono font-bold text-xs text-[var(--color-fg)]">
            {row.sku}
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] truncate max-w-[200px]">
            {row.productTitle} {row.variantTitle ? `· ${row.variantTitle}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-fg)]">
          {row.movementType}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => (
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {row.reasonCode}
        </span>
      ),
    },
    {
      id: "delta",
      header: "Qty Delta",
      align: "right",
      cell: (row) => {
        const isPositive = row.quantityDelta > 0;
        return (
          <span
            className={`font-mono text-xs font-bold inline-flex items-center gap-0.5 ${
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            <span>{isPositive ? `+${row.quantityDelta}` : row.quantityDelta}</span>
          </span>
        );
      },
    },
    {
      id: "balance",
      header: "Balance After",
      align: "right",
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-[var(--color-fg)]">
          {row.onHandAfter}
        </span>
      ),
    },
    {
      id: "actor",
      header: "By",
      cell: (row) => {
        const isSystem = row.createdBy === "System";
        return (
          <div className="flex items-center gap-1 text-[11px]">
            {isSystem ? (
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                <Bot size={13} />
                <span>System</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--color-fg)] font-semibold">
                <User size={13} />
                <span>{row.createdBy}</span>
              </span>
            )}
            {row.referenceType === "ORDER" && row.referenceId && (
              <Link
                href={`/admin/orders/${row.referenceId}`}
                target="_blank"
                className="text-[var(--color-primary)] hover:underline ml-1 inline-flex items-center"
                title={`Order #${row.referenceId}`}
              >
                <ExternalLink size={10} />
              </Link>
            )}
          </div>
        );
      },
    },
    {
      id: "note",
      header: "Note / Ref",
      cell: (row) => (
        <span className="text-[11px] text-[var(--color-fg-muted)] italic truncate max-w-xs block">
          {row.note || (row.referenceId ? `${row.referenceType}: ${row.referenceId}` : "—")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Movements Ledger"
        subtitle="Immutable append-only stock transaction history across all SKUs"
        secondaryAction={{
          label: "Export Ledger CSV",
          icon: FileSpreadsheet,
          onClick: () => {
            window.location.href = "/api/admin/inventory/export?type=movements";
          },
        }}
      />

      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          {/* Movement Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="RESERVATION">RESERVATION</option>
            <option value="FULFILMENT">FULFILMENT</option>
            <option value="RELEASE">RELEASE</option>
            <option value="RETURN">RETURN</option>
          </select>

          {/* Reason Code Filter */}
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none"
          >
            <option value="ALL">All Reasons</option>
            <option value="PURCHASE">PURCHASE</option>
            <option value="SALE">SALE</option>
            <option value="RETURN">RETURN</option>
            <option value="DAMAGE">DAMAGE</option>
            <option value="THEFT">THEFT</option>
            <option value="CORRECTION">CORRECTION</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
        </div>

        <span className="text-xs text-[var(--color-fg-muted)]">
          {filteredMovements.length} immutable ledger entries shown
        </span>
      </div>

      {/* MOVEMENTS DATATABLE */}
      <DataTable
        tableId="movements_ledger_table"
        columns={columns}
        data={filteredMovements}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search by SKU, product name, or actor…"
        emptyTitle="No stock movements in this period"
        emptyDescription="All stock adjustments, reservations, fulfilments, and returns are permanently recorded here."
      />
    </div>
  );
}
