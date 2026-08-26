"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "normal" | "wide"; // 480px or 640px as per Spec 00 (6.5)
  className?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "normal",
  className,
}: DrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass =
    width === "wide"
      ? "w-full max-w-[var(--drawer-width-wide)]" // 640px
      : "w-full max-w-[var(--drawer-width)]"; // 480px

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        {/* Sliding Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "drawer-title" : undefined}
          aria-describedby={subtitle ? "drawer-subtitle" : undefined}
          className={cn(
            "relative bg-[var(--color-surface)] shadow-[var(--shadow-lg)] border-l border-[var(--color-border)] flex flex-col h-full transform transition ease-in-out duration-200 animate-in slide-in-from-right",
            widthClass,
            className
          )}
        >
          {/* Header */}
          {(title || subtitle) && (
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                {title && (
                  <h3
                    id="drawer-title"
                    className="text-[var(--text-lg)] font-semibold text-[var(--color-fg)]"
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p
                    id="drawer-subtitle"
                    className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1"
                  >
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="p-4 bg-[var(--color-surface-sunken)] border-t border-[var(--color-border)] flex items-center justify-end gap-3 flex-wrap">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
