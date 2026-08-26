"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with ellipsis for large ranges
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [1];

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] text-[var(--text-sm)]",
        className
      )}
    >
      {/* Item count summary */}
      <div className="flex items-center gap-4 text-[var(--color-fg-muted)]">
        <span>
          Showing{" "}
          <strong className="font-mono text-[var(--color-fg)] font-medium">
            {startItem.toLocaleString("en-IN")}–{endItem.toLocaleString("en-IN")}
          </strong>{" "}
          of{" "}
          <strong className="font-mono text-[var(--color-fg)] font-medium">
            {totalItems.toLocaleString("en-IN")}
          </strong>
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pageSizeSelect" className="text-[var(--text-xs)] text-[var(--color-fg-muted)]">
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-[30px] px-2 py-0.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--text-xs)] font-mono text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <nav aria-label="Pagination Navigation" className="flex items-center gap-1">
        {/* First page button if >10 pages */}
        {totalPages > 10 && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="Go to first page"
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          >
            <ChevronsLeft size={16} />
          </button>
        )}

        {/* Previous page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="h-8 px-2.5 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-[var(--text-xs)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Numbered pages */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((page, idx) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-[var(--color-fg-subtle)] font-mono text-[var(--text-xs)] select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-xs)] font-mono font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                  isCurrent
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold shadow-sm"
                    : "text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)]"
                )}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="h-8 px-2.5 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-[var(--text-xs)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </button>

        {/* Last page button if >10 pages */}
        {totalPages > 10 && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            aria-label="Go to last page"
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          >
            <ChevronsRight size={16} />
          </button>
        )}
      </nav>
    </div>
  );
}
