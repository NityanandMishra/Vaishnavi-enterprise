"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns,
  Download,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "./EmptyState";
import Pagination from "./Pagination";
import BulkActionBar, { BulkAction } from "./BulkActionBar";
import FilterBar, { ActiveFilter } from "./FilterBar";

export interface ColumnDef<T> {
  id: string;
  header: string | React.ReactNode;
  accessorKey?: keyof T | string;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  isMono?: boolean;
  priority?: "high" | "medium" | "low"; // Responsive hiding priority
  minWidth?: string;
  width?: string;
}

interface DataTableProps<T> {
  tableId: string; // Used for persisting column visibility in localStorage
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T) => string;

  // Search & Filters
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (key: string, value?: string) => void;
  onClearFilters?: () => void;
  filterSlots?: React.ReactNode;

  // Sorting
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (columnId: string, direction: "asc" | "desc" | null) => void;

  // Selection & Bulk Actions
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: BulkAction[];

  // Pagination
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Export
  onExportCsv?: () => void;
  isExporting?: boolean;

  // States
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;

  // Row Interactions
  onRowClick?: (item: T) => void;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  tableId,
  columns,
  data,
  keyExtractor,

  searchPlaceholder = "Search records…",
  searchValue = "",
  onSearchChange,
  activeFilters = [],
  onRemoveFilter,
  onClearFilters,
  filterSlots,

  sortColumn,
  sortDirection,
  onSortChange,

  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],

  currentPage = 1,
  pageSize = 50,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,

  onExportCsv,
  isExporting = false,

  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "There are no records to display at this time.",
  emptyActionLabel,
  emptyActionHref,
  onEmptyAction,

  onRowClick,
  className,
}: DataTableProps<T>) {
  // ── Column Visibility State (Persisted in localStorage) ─────────────────────
  const [visibleColIds, setVisibleColIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`dt_cols_${tableId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return new Set(parsed);
        }
      } catch (_) {}
    }
    return new Set(columns.map((c) => c.id));
  });

  const [isColMenuOpen, setIsColMenuOpen] = useState(false);

  function toggleColumn(colId: string) {
    setVisibleColIds((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size > 1) next.delete(colId);
      } else {
        next.add(colId);
      }
      try {
        localStorage.setItem(`dt_cols_${tableId}`, JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  }

  // ── Search Input Debouncing ────────────────────────────────────────────────
  const [localSearch, setLocalSearch] = useState(searchValue);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (!onSearchChange) return;
    const timer = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 300); // 300ms debounce as per Spec 00 (NFR-02)

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, searchValue]);

  // ── Row Selection Logic ────────────────────────────────────────────────────
  const allRowKeys = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const isAllSelected =
    data.length > 0 && allRowKeys.every((id) => selectedIds.includes(id));
  const isSomeSelected =
    selectedIds.length > 0 && !isAllSelected && allRowKeys.some((id) => selectedIds.includes(id));

  function handleSelectAll() {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      // Unselect all in current page
      onSelectionChange(selectedIds.filter((id) => !allRowKeys.includes(id)));
    } else {
      // Add all current page keys to selection
      const next = Array.from(new Set([...selectedIds, ...allRowKeys]));
      onSelectionChange(next);
    }
  }

  function handleToggleRow(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(key)) {
      onSelectionChange(selectedIds.filter((id) => id !== key));
    } else {
      onSelectionChange([...selectedIds, key]);
    }
  }

  // ── Sort Cycling ───────────────────────────────────────────────────────────
  function handleHeaderSort(colId: string) {
    if (!onSortChange) return;
    if (sortColumn !== colId) {
      onSortChange(colId, "asc");
    } else if (sortDirection === "asc") {
      onSortChange(colId, "desc");
    } else {
      onSortChange(colId, null);
    }
  }

  const activeVisibleColumns = columns.filter((c) => visibleColIds.has(c.id));
  const isFiltered = activeFilters.length > 0 || !!searchValue.trim();

  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] flex flex-col overflow-hidden",
        className
      )}
    >
      {/* ── 1. TOOLBAR / BULK ACTION BAR ──────────────────────────────────── */}
      <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {selectedIds.length > 0 && bulkActions.length > 0 ? (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => onSelectionChange && onSelectionChange([])}
            actions={bulkActions}
          />
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] pointer-events-none"
              />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-[var(--input-height)] pl-9 pr-3 rounded-[var(--input-radius)] bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--color-fg)] text-[var(--text-sm)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--input-border-focus)] focus:border-[var(--input-border-focus)] transition-colors"
                aria-label={searchPlaceholder}
              />
            </div>

            {/* Right Action Tools (Filters, Columns, Export) */}
            <div className="flex items-center gap-2 flex-wrap">
              {filterSlots}

              {/* Column Visibility Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColMenuOpen((prev) => !prev)}
                  aria-expanded={isColMenuOpen}
                  aria-label="Toggle table columns"
                  className="h-[var(--btn-height-sm)] px-2.5 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] text-[var(--text-xs)] font-medium inline-flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
                >
                  <Columns size={14} />
                  <span>Columns</span>
                </button>

                {isColMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsColMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] z-30 animate-in fade-in zoom-in-95 duration-100 text-[var(--text-xs)]">
                      <div className="px-3 py-1 text-[var(--text-xs)] font-semibold text-[var(--color-fg-muted)] border-b border-[var(--color-border)] mb-1">
                        Visible Columns
                      </div>
                      {columns.map((col) => {
                        const isVisible = visibleColIds.has(col.id);
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => toggleColumn(col.id)}
                            className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-[var(--color-surface-sunken)] transition-colors text-[var(--color-fg)]"
                          >
                            <span className="truncate">
                              {typeof col.header === "string" ? col.header : col.id}
                            </span>
                            {isVisible && <Check size={14} className="text-[var(--color-primary)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Export Button */}
              {onExportCsv && (
                <button
                  type="button"
                  onClick={onExportCsv}
                  disabled={isExporting || isLoading}
                  aria-label="Export table data to CSV"
                  className="h-[var(--btn-height-sm)] px-2.5 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] text-[var(--text-xs)] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
                >
                  <Download size={14} />
                  <span>{isExporting ? "Exporting…" : "Export"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && onRemoveFilter && onClearFilters && (
          <FilterBar
            filters={activeFilters}
            onRemoveFilter={onRemoveFilter}
            onClearAll={onClearFilters}
            className="mt-2"
          />
        )}
      </div>

      {/* ── 2. ERROR STATE BANNER ─────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-[var(--color-danger-subtle)] border-b border-[var(--color-danger)] text-[var(--color-danger)] flex items-center justify-between gap-3 text-[var(--text-sm)]">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] text-[var(--text-xs)] font-medium transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── 3. TABLE BODY ─────────────────────────────────────────────────── */}
      <div className="relative overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          {/* Header */}
          <thead className="bg-[var(--table-header-bg)] border-b border-[var(--color-border)] sticky top-0 z-10">
            <tr className="h-[var(--table-header-height)]">
              {selectable && (
                <th
                  scope="col"
                  className="w-10 px-4 py-2 text-center align-middle"
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="w-4 h-4 rounded-[var(--radius-sm)] border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-ring)] cursor-pointer"
                  />
                </th>
              )}

              {activeVisibleColumns.map((col) => {
                const isSortActive = sortColumn === col.id;
                const alignClass =
                  col.align === "right"
                    ? "text-right justify-end"
                    : col.align === "center"
                    ? "text-center justify-center"
                    : "text-left justify-start";

                return (
                  <th
                    key={col.id}
                    scope="col"
                    style={{ minWidth: col.minWidth, width: col.width }}
                    className={cn(
                      "px-[var(--table-cell-px)] py-2 text-[var(--text-xs)] font-semibold uppercase tracking-[0.05em] text-[var(--color-fg-muted)] select-none",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleHeaderSort(col.id)}
                        aria-sort={
                          isSortActive
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 hover:text-[var(--color-fg)] transition-colors focus:outline-none focus:text-[var(--color-primary)]",
                          alignClass,
                          isSortActive && "text-[var(--color-primary)] font-bold"
                        )}
                      >
                        <span>{col.header}</span>
                        {isSortActive ? (
                          sortDirection === "asc" ? (
                            <ArrowUp size={13} className="text-[var(--color-primary)]" />
                          ) : (
                            <ArrowDown size={13} className="text-[var(--color-primary)]" />
                          )
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--table-border)] bg-[var(--color-surface)]">
            {/* 1. Loading Skeleton Shimmer (8 rows, 44px height each — no CLS) */}
            {isLoading && (
              Array.from({ length: 8 }).map((_, rIdx) => (
                <tr
                  key={`skeleton-${rIdx}`}
                  className="h-[var(--table-row-height)] animate-pulse"
                >
                  {selectable && (
                    <td className="w-10 px-4 py-2 text-center">
                      <div className="w-4 h-4 bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)] mx-auto" />
                    </td>
                  )}
                  {activeVisibleColumns.map((col, cIdx) => (
                    <td
                      key={`skeleton-cell-${cIdx}`}
                      className="px-[var(--table-cell-px)] py-2"
                    >
                      <div
                        className={cn(
                          "h-3.5 bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)]",
                          cIdx === 0 ? "w-3/4" : "w-1/2",
                          col.align === "right" && "ml-auto"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {/* 2. Empty State */}
            {!isLoading && data.length === 0 && (
              <tr>
                <td
                  colSpan={activeVisibleColumns.length + (selectable ? 1 : 0)}
                  className="p-0 border-none"
                >
                  <EmptyState
                    title={isFiltered ? "No records match these filters" : emptyTitle}
                    description={
                      isFiltered
                        ? "Try adjusting your search keywords or clearing active filters."
                        : emptyDescription
                    }
                    isFiltered={isFiltered}
                    onClearFilters={onClearFilters}
                    actionLabel={emptyActionLabel}
                    actionHref={emptyActionHref}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            )}

            {/* 3. Populated Data Rows */}
            {!isLoading &&
              data.map((row, rowIdx) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedIds.includes(rowKey);

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      "h-[var(--table-row-height)] transition-colors text-[var(--text-sm)] text-[var(--color-fg)]",
                      onRowClick && "cursor-pointer",
                      isSelected
                        ? "bg-[var(--table-row-selected-bg)]"
                        : "hover:bg-[var(--table-row-hover-bg)]"
                    )}
                  >
                    {selectable && (
                      <td
                        className="w-10 px-4 py-2 text-center align-middle"
                        onClick={(e) => handleToggleRow(rowKey, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by td onClick
                          aria-label={`Select row ${rowKey}`}
                          className="w-4 h-4 rounded-[var(--radius-sm)] border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-ring)] cursor-pointer"
                        />
                      </td>
                    )}

                    {activeVisibleColumns.map((col) => {
                      const value = col.accessorKey
                        ? (row as any)[col.accessorKey]
                        : null;

                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "px-[var(--table-cell-px)] py-2 align-middle",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.isMono && "font-mono font-normal tracking-tight"
                          )}
                        >
                          {col.cell ? col.cell(row, rowIdx) : (value ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ── 4. FOOTER / PAGINATION ────────────────────────────────────────── */}
      {totalItems > 0 && onPageChange && (
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
