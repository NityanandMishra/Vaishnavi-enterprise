"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  countBadge?: string | number;
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
  overflowActions?: HeaderAction[];
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  countBadge,
  primaryAction,
  secondaryAction,
  overflowActions = [],
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {/* Optional Breadcrumbs Segment */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-fg-muted)]">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[var(--color-fg-subtle)]">/</span>}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[var(--color-fg)] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && "text-[var(--color-fg)] font-medium")}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Main Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title & Count Badge */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[var(--text-2xl)] font-bold text-[var(--color-fg)] leading-tight">
              {title}
            </h1>
            {countBadge !== undefined && countBadge !== null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--text-xs)] font-mono font-medium text-[var(--color-fg-muted)]">
                {countBadge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[var(--text-sm)] text-[var(--color-fg-muted)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions Cluster: Secondary -> Primary -> Overflow */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Secondary Action */}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="h-[var(--btn-height-md)] px-3.5 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] text-[var(--text-sm)] font-medium inline-flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                {secondaryAction.icon && <secondaryAction.icon size={16} />}
                <span>{secondaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                className="h-[var(--btn-height-md)] px-3.5 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] text-[var(--text-sm)] font-medium inline-flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
              >
                {secondaryAction.icon && <secondaryAction.icon size={16} />}
                <span>{secondaryAction.label}</span>
              </button>
            )
          )}

          {/* Primary Action (Single CTA Rule per Section 5.3) */}
          {primaryAction && (
            primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className="h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--color-on-primary)] text-[var(--text-sm)] font-medium inline-flex items-center gap-1.5 shadow-[var(--shadow-sm)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
              >
                {primaryAction.icon ? <primaryAction.icon size={16} /> : <Plus size={16} />}
                <span>{primaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--color-on-primary)] text-[var(--text-sm)] font-medium inline-flex items-center gap-1.5 shadow-[var(--shadow-sm)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1 disabled:opacity-50"
              >
                {primaryAction.icon ? <primaryAction.icon size={16} /> : <Plus size={16} />}
                <span>{primaryAction.label}</span>
              </button>
            )
          )}

          {/* Overflow Menu (⋯) */}
          {overflowActions.length > 0 && (
            <div ref={overflowRef} className="relative">
              <button
                type="button"
                onClick={() => setIsOverflowOpen((prev) => !prev)}
                aria-expanded={isOverflowOpen}
                aria-label="More page actions"
                className="w-[var(--btn-height-md)] h-[var(--btn-height-md)] rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                <MoreHorizontal size={16} />
              </button>

              {isOverflowOpen && (
                <div className="absolute right-0 mt-1 w-48 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] z-30 text-[var(--text-sm)] animate-in fade-in zoom-in-95 duration-100">
                  {overflowActions.map((action, idx) => (
                    action.href ? (
                      <Link
                        key={idx}
                        href={action.href}
                        onClick={() => setIsOverflowOpen(false)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                      >
                        {action.icon && <action.icon size={14} className="text-[var(--color-fg-muted)]" />}
                        <span>{action.label}</span>
                      </Link>
                    ) : (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIsOverflowOpen(false);
                          action.onClick?.();
                        }}
                        disabled={action.disabled}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors disabled:opacity-50"
                      >
                        {action.icon && <action.icon size={14} className="text-[var(--color-fg-muted)]" />}
                        <span>{action.label}</span>
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
