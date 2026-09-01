"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  subtitle,
  children,
  footer,
  maxWidth = "md",
  className,
}: ModalProps) {
  const descText = description || subtitle;
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

  const maxWidthClasses = {
    sm: "max-w-[400px]",
    md: "max-w-[480px]",
    lg: "max-w-[560px]",
    xl: "max-w-[640px]",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-desc" : undefined}
        className={cn(
          "relative w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]",
          maxWidthClasses,
          className
        )}
      >
        {/* Header */}
        {(title || descText) && (
          <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <div>
              {title && (
                <h3
                  id="modal-title"
                  className="text-[var(--text-lg)] font-semibold text-[var(--color-fg)]"
                >
                  {title}
                </h3>
              )}
              {descText && (
                <p
                  id="modal-desc"
                  className="text-[var(--text-sm)] text-[var(--color-fg-muted)] mt-1"
                >
                  {descText}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer Actions */}
        {footer && (
          <div className="p-4 bg-[var(--color-surface-sunken)] border-t border-[var(--color-border)] flex items-center justify-end gap-3 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
