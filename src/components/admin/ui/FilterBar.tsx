"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue?: string;
}

interface FilterBarProps {
  filters: ActiveFilter[];
  onRemoveFilter: (key: string, value?: string) => void;
  onClearAll: () => void;
  className?: string;
}

export default function FilterBar({
  filters,
  onRemoveFilter,
  onClearAll,
  className,
}: FilterBarProps) {
  if (!filters || filters.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap py-2 px-1 text-[var(--text-xs)]",
        className
      )}
      aria-label="Active filters"
    >
      <span className="text-[var(--color-fg-muted)] font-medium">Filtered by:</span>

      {filters.map((filter) => (
        <span
          key={`${filter.key}-${filter.value}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-fg)] font-medium transition-colors"
        >
          <span className="text-[var(--color-fg-muted)]">{filter.label}:</span>
          <span>{filter.displayValue || filter.value}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter(filter.key, filter.value)}
            aria-label={`Remove filter for ${filter.label}: ${filter.displayValue || filter.value}`}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline font-medium text-[var(--text-xs)] ml-1 focus:outline-none focus:underline"
      >
        Clear all
      </button>
    </div>
  );
}
