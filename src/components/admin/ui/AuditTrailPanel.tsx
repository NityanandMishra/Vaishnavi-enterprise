"use client";

import React, { useState } from "react";
import { User, Clock, ChevronDown, ChevronRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditRecord } from "@/lib/types/admin";
import StatusBadge from "./StatusBadge";

interface AuditTrailPanelProps {
  records: AuditRecord[];
  isLoading?: boolean;
  className?: string;
}

export default function AuditTrailPanel({
  records,
  isLoading = false,
  className,
}: AuditTrailPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function formatRelativeTime(dateInput: string | Date) {
    const d = new Date(dateInput);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  }

  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4 animate-pulse", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-sunken)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[var(--color-surface-sunken)] rounded w-1/3" />
              <div className="h-3 bg-[var(--color-surface-sunken)] rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div
        className={cn(
          "p-6 text-center text-[var(--color-fg-muted)] text-[var(--text-xs)]",
          className
        )}
      >
        <History size={20} className="mx-auto mb-2 text-[var(--color-fg-subtle)]" />
        No audit activity recorded yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 text-[var(--text-sm)]", className)}>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--color-border)]">
        {records.map((record) => {
          const isExpanded = expandedId === record.id;
          const hasDiff = record.beforeState || record.afterState;
          const absoluteTime = new Date(record.timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          });

          return (
            <div key={record.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-primary)] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
              </div>

              {/* Record Content */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-fg)] text-[var(--text-xs)]">
                      {record.actorName}
                    </span>
                    <StatusBadge status={record.actorRole} showDot={false} />
                  </div>

                  <span
                    title={absoluteTime}
                    className="text-[11px] font-mono text-[var(--color-fg-muted)] flex items-center gap-1 cursor-help"
                  >
                    <Clock size={11} />
                    {formatRelativeTime(record.timestamp)}
                  </span>
                </div>

                <p className="text-[var(--text-xs)] text-[var(--color-fg)]">
                  {record.action}
                </p>

                {hasDiff && (
                  <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={() => toggleExpand(record.id)}
                      className="text-[11px] text-[var(--color-primary)] font-medium inline-flex items-center gap-1 hover:underline focus:outline-none"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>{isExpanded ? "Hide change details" : "View change details"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2 bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)] font-mono text-[11px] overflow-x-auto space-y-1">
                        {record.beforeState && (
                          <div>
                            <span className="text-[var(--color-danger)] font-semibold">- Before: </span>
                            <pre className="inline">{JSON.stringify(record.beforeState, null, 2)}</pre>
                          </div>
                        )}
                        {record.afterState && (
                          <div>
                            <span className="text-[var(--color-success)] font-semibold">+ After: </span>
                            <pre className="inline">{JSON.stringify(record.afterState, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
