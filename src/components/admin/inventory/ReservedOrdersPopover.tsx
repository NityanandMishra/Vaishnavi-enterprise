"use client";

import React, { useState, useRef, useEffect } from "react";
import { ShoppingBag, ExternalLink, X, Clock } from "lucide-react";
import Link from "next/link";

export interface ReservedOrderInfo {
  orderId: string;
  quantity: number;
  status: string;
  createdAt: string | Date;
  customerName: string;
  customerPhone?: string | null;
}

interface ReservedOrdersPopoverProps {
  count: number;
  orders: ReservedOrderInfo[];
  sku?: string | null;
  productTitle?: string;
}

export default function ReservedOrdersPopover({
  count,
  orders,
  sku,
  productTitle,
}: ReservedOrdersPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (count === 0) {
    return <span className="font-mono text-[var(--color-fg-muted)]">0</span>;
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1 group"
        title="Click to view open orders holding this reservation"
      >
        <span>{count}</span>
        <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-sans group-hover:bg-amber-200">
          orders
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-amber-600" />
              <div>
                <h4 className="text-xs font-bold text-[var(--color-fg)]">
                  Reserved by {orders.length} Order{orders.length === 1 ? "" : "s"}
                </h4>
                {sku && (
                  <p className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                    SKU: {sku}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-[var(--color-border)]/50">
            {orders.length === 0 ? (
              <p className="text-xs text-[var(--color-fg-muted)] py-2 text-center">
                Reservation data loading or expired.
              </p>
            ) : (
              orders.map((order, idx) => (
                <div key={order.orderId || idx} className="pt-2 first:pt-0">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/admin/orders/${order.orderId}`}
                      className="text-xs font-mono font-bold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                      target="_blank"
                    >
                      <span>#{order.orderId.slice(0, 8)}…</span>
                      <ExternalLink size={10} />
                    </Link>
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                      {order.quantity} unit{order.quantity > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] mt-1">
                    <span>{order.customerName}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
            <span>Total reserved:</span>
            <span className="font-mono font-bold text-[var(--color-fg)]">
              {orders.reduce((sum, o) => sum + o.quantity, 0)} units
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
