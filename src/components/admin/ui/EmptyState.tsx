"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon, Inbox, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  onSecondary?: () => void;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  onSecondary,
  isFiltered,
  onClearFilters,
  className,
}: EmptyStateProps) {
  const DisplayIcon = isFiltered ? FilterX : Icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 lg:p-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] my-4",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center mb-4 text-[var(--color-fg-subtle)]">
        <DisplayIcon size={24} strokeWidth={1.75} aria-hidden="true" />
      </div>

      <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-fg)] mb-1">
        {title}
      </h3>

      <p className="text-[var(--text-sm)] text-[var(--color-fg-muted)] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {isFiltered && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center justify-center h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--text-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
          >
            Clear Filters
          </button>
        )}

        {!isFiltered && actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--text-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--text-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
            >
              {actionLabel}
            </button>
          )
        )}

        {secondaryLabel && (secondaryHref || onSecondary) && (
          secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center h-[var(--btn-height-md)] px-3 text-[var(--text-sm)] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors focus:outline-none focus:underline"
            >
              {secondaryLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center justify-center h-[var(--btn-height-md)] px-3 text-[var(--text-sm)] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors focus:outline-none focus:underline"
            >
              {secondaryLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}
