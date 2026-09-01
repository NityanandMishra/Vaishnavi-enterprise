"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  undoAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string, undoAction?: () => void) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

type ToastEvent = {
  type: ToastType;
  title: string;
  message?: string;
  undoAction?: () => void;
  duration?: number;
};

const listeners: Array<(event: ToastEvent) => void> = [];

export const toast = {
  success: (title: string, message?: string, undoAction?: () => void) => {
    listeners.forEach((fn) => fn({ type: "success", title, message, undoAction }));
  },
  error: (title: string, message?: string) => {
    listeners.forEach((fn) => fn({ type: "error", title, message }));
  },
  info: (title: string, message?: string) => {
    listeners.forEach((fn) => fn({ type: "info", title, message }));
  },
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return toast;
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, undoAction, duration }: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      const effectiveDuration = duration ?? (type === "error" ? 6000 : 4000); // 4s success / 6s error per Spec 00 (6.6)

      setToasts((prev) => {
        // Stack maximum 3
        const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
        return [...trimmed, { id, type, title, message, undoAction, duration: effectiveDuration }];
      });
    },
    []
  );

  useEffect(() => {
    const handler = (event: ToastEvent) => {
      showToast(event);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, [showToast]);

  const success = useCallback(
    (title: string, message?: string, undoAction?: () => void) => {
      showToast({ type: "success", title, message, undoAction });
    },
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "error", title, message });
    },
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "info", title, message });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {/* Toast Container Top-Right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const Icon =
    toast.type === "success"
      ? CheckCircle2
      : toast.type === "error"
      ? AlertCircle
      : Info;

  const iconStyles = {
    success: "text-[var(--color-success)]",
    error: "text-[var(--color-danger)]",
    info: "text-[var(--color-info)]",
  }[toast.type];

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] animate-in fade-in slide-in-from-top-2 duration-150 text-[var(--text-sm)] text-[var(--color-fg)]"
    >
      <Icon size={18} className={cn("flex-shrink-0 mt-0.5", iconStyles)} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-fg)]">{toast.title}</p>
        {toast.message && (
          <p className="text-[var(--text-xs)] text-[var(--color-fg-muted)] mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        )}
        {toast.undoAction && (
          <button
            type="button"
            onClick={() => {
              toast.undoAction?.();
              onDismiss();
            }}
            className="mt-2 text-[var(--text-xs)] font-bold text-[var(--color-primary)] hover:underline focus:outline-none"
          >
            Undo
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
