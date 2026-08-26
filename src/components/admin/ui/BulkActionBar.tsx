"use client";

import React from "react";
import { X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger" | "secondary";
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export default function BulkActionBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5 bg-[var(--color-primary-subtle)] border border-[var(--color-primary)] rounded-[var(--radius-md)] text-[var(--text-sm)] shadow-[var(--shadow-sm)] animate-in fade-in slide-in-from-top-2 duration-150",
        className
      )}
      role="region"
      aria-label="Bulk actions toolbar"
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-[var(--color-primary)]">
          <span className="font-mono">{selectedCount}</span> {selectedCount === 1 ? "item" : "items"} selected
        </span>

        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors focus:outline-none focus:underline"
        >
          <X size={13} />
          Clear
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          const isDanger = action.variant === "danger";

          return (
            <button
              key={idx}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "inline-flex items-center gap-1.5 h-[var(--btn-height-sm)] px-3 rounded-[var(--btn-radius)] text-[var(--text-xs)] font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
                isDanger
                  ? "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)]"
                  : "bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)]"
              )}
            >
              {Icon && <Icon size={14} />}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
