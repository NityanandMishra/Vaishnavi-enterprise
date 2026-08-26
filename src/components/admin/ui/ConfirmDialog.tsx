"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string; // Must name the object: e.g. "Delete Cotton Kurta Set?"
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  requiresCountConfirmation?: boolean; // For bulk >10 records
  confirmationCount?: number;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  requiresCountConfirmation = false,
  confirmationCount = 0,
  isLoading = false,
}: ConfirmDialogProps) {
  const [typedCount, setTypedCount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTypedCount("");
    }
  }, [isOpen]);

  const isCountValid =
    !requiresCountConfirmation ||
    typedCount.trim() === confirmationCount.toString();

  const isDanger = variant === "danger";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] text-[var(--text-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isCountValid || isLoading}
            className={cn(
              "h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] text-[var(--text-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
              isDanger
                ? "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] focus:ring-[var(--color-danger)]"
                : "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-ring)]"
            )}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-[var(--text-sm)]">
        <div className="flex items-start gap-3">
          {isDanger && (
            <div className="w-9 h-9 rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={18} />
            </div>
          )}
          <p className="text-[var(--color-fg-muted)] leading-relaxed">{description}</p>
        </div>

        {requiresCountConfirmation && confirmationCount > 10 && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <label
              htmlFor="confirmCountInput"
              className="block text-[var(--text-xs)] font-medium text-[var(--color-fg)] mb-1"
            >
              To confirm, type the count (<strong>{confirmationCount}</strong>) below:
            </label>
            <input
              id="confirmCountInput"
              type="text"
              value={typedCount}
              onChange={(e) => setTypedCount(e.target.value)}
              placeholder={confirmationCount.toString()}
              className="w-full h-[var(--input-height)] px-3 rounded-[var(--input-radius)] border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--color-fg)] font-mono text-[var(--text-sm)] focus:outline-none focus:ring-1 focus:ring-[var(--input-border-focus)]"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
