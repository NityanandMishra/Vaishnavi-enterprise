"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ConfirmDialog from "./ConfirmDialog";

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <div
      className={cn(
        "py-6 border-b border-[var(--color-border)] last:border-b-0 space-y-4",
        className
      )}
    >
      <div>
        <h4 className="text-[var(--text-lg)] font-semibold text-[var(--color-fg)]">
          {title}
        </h4>
        {description && (
          <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required,
  optional,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[var(--text-sm)] font-medium text-[var(--color-fg)] flex items-center gap-1.5"
        >
          <span>{label}</span>
          {optional && (
            <span className="text-[var(--text-xs)] font-normal text-[var(--color-fg-muted)]">
              (optional)
            </span>
          )}
          {required && (
            <span className="text-[var(--color-danger)] font-bold text-xs" title="Required">
              *
            </span>
          )}
        </label>
      </div>

      {children}

      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          className="text-[var(--text-xs)] text-[var(--color-danger)] flex items-center gap-1 mt-1 font-medium"
        >
          <AlertCircle size={12} className="flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p
          id={id ? `${id}-hint` : undefined}
          className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-1"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface FormLayoutProps {
  title?: string;
  subtitle?: string;
  lastAutosavedText?: string;
  isDirty?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  errorBanner?: string | null;
  successBanner?: string | null;
  sidebarHelp?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function FormLayout({
  title,
  subtitle,
  lastAutosavedText,
  isDirty = false,
  isSubmitting = false,
  submitLabel = "Save Changes",
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
  errorBanner,
  successBanner,
  sidebarHelp,
  children,
  className,
}: FormLayoutProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  function handleCancelClick() {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else if (onCancel) {
      onCancel();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("space-y-6 max-w-full", className)}
    >
      {/* Header bar if title provided */}
      {(title || subtitle || lastAutosavedText) && (
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)] flex-wrap">
          <div>
            {title && (
              <h2 className="text-[var(--text-2xl)] font-bold text-[var(--color-fg)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[var(--text-sm)] text-[var(--color-fg-muted)] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {lastAutosavedText && (
            <span className="text-[var(--text-xs)] font-mono text-[var(--color-fg-muted)]">
              {lastAutosavedText}
            </span>
          )}
        </div>
      )}

      {/* Error / Success Top Banners */}
      {errorBanner && (
        <div className="p-4 bg-[var(--color-danger-subtle)] border border-[var(--color-danger)] rounded-[var(--radius-md)] text-[var(--color-danger)] text-[var(--text-sm)] flex items-start gap-3">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Please check the following errors:</strong>
            <p className="mt-0.5">{errorBanner}</p>
          </div>
        </div>
      )}

      {successBanner && (
        <div className="p-4 bg-[var(--color-success-subtle)] border border-[var(--color-success)] rounded-[var(--radius-md)] text-[var(--color-success)] text-[var(--text-sm)] flex items-start gap-3">
          <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p>{successBanner}</p>
          </div>
        </div>
      )}

      {/* Two Column Layout on >= 1024px */}
      <div className="lg:grid lg:grid-cols-[minmax(0,720px)_minmax(280px,1fr)] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
        {/* Main Form Fields Container */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] space-y-2">
          {children}

          {/* Form Action Controls */}
          <div className="pt-6 border-t border-[var(--color-border)] flex items-center justify-end gap-3 flex-wrap">
            {onCancel && (
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isSubmitting}
                className="h-[var(--btn-height-md)] px-4 rounded-[var(--btn-radius)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg)] text-[var(--text-sm)] font-medium transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[var(--btn-height-md)] px-5 rounded-[var(--btn-radius)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] text-[var(--text-sm)] font-medium transition-colors flex items-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Help / Summary Rail */}
        {sidebarHelp && (
          <div className="sticky top-20 space-y-4">
            {sidebarHelp}
          </div>
        )}
      </div>

      {/* Discard Unsaved Changes Dialog */}
      <ConfirmDialog
        isOpen={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          setShowDiscardDialog(false);
          if (onCancel) onCancel();
        }}
        title="Discard unsaved changes?"
        description="You have modified fields in this form. If you navigate away now, your edits will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="warning"
      />
    </form>
  );
}
