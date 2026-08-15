"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared modal shell.
 *
 * Every dialog in the app previously hand-rolled `fixed inset-0 z-50`, which
 * left four defects in common:
 *
 *  - z-50 tied with the mobile bottom nav and the admin sidebar. Because the
 *    nav renders after the page content, it painted over the bottom ~65px of
 *    any open dialog — exactly where the submit button sits.
 *  - the dialog rendered inside the page tree, so any ancestor that creates a
 *    containing block (transform, filter, contain) would drag it out of place.
 *  - the page kept scrolling behind the backdrop.
 *  - Escape did nothing, focus stayed on <body>, and Tab walked the page
 *    underneath.
 *
 * This component portals to document.body, sits on its own layer above all
 * chrome, locks scroll, closes on Escape, and traps and restores focus.
 */

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer pinned below the scrolling body — keeps actions always reachable. */
  footer?: React.ReactNode;
  /**
   * "centered" floats a panel at all sizes.
   * "sheet" docks to the bottom on mobile and centres from lg up.
   */
  variant?: "centered" | "sheet";
  /** Tailwind max-width for the panel. */
  maxWidth?: string;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "centered",
  maxWidth = "max-w-md",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      // Keep Tab inside the dialog.
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    // Lock the page behind the backdrop, compensating for the scrollbar so the
    // layout does not jump sideways as it disappears.
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    document.addEventListener("keydown", onKeyDown, true);

    // Focus the first control, falling back to the panel itself.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open || typeof document === "undefined") return null;

  const sheet = variant === "sheet";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-modal flex",
        sheet ? "items-end lg:items-center lg:justify-center" : "items-center justify-center p-4"
      )}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-surface shadow-2xl flex flex-col outline-none",
          sheet
            ? "rounded-t-xl lg:rounded-lg max-h-[85vh] lg:max-w-md"
            : cn("rounded-lg max-h-[min(85vh,44rem)]", maxWidth),
          className
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border-base flex-shrink-0">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-surface-alt transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div className="flex-shrink-0 border-t border-border-base px-5 py-4 bg-surface rounded-b-xl lg:rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
