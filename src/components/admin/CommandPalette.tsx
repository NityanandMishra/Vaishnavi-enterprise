"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ShoppingBag,
  Tag,
  FolderTree,
  Sliders,
  Settings,
  Layers,
  Truck,
  CreditCard,
  History,
  FileText,
  Scale,
  X,
  ArrowRight,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  category: "Navigation" | "Catalog" | "Orders" | "System";
  title: string;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

const STATIC_COMMANDS: CommandItem[] = [
  // Navigation
  { id: "nav-dash", category: "Navigation", title: "Go to Dashboard", href: "/admin", icon: Layers, keywords: ["home", "overview", "analytics"] },
  { id: "nav-products", category: "Catalog", title: "View Products", href: "/admin/products", icon: Package, keywords: ["items", "inventory", "stock", "catalog"] },
  { id: "nav-new-prod", category: "Catalog", title: "Add New Product", href: "/admin/products/new", icon: Package, keywords: ["create", "add"] },
  { id: "nav-images", category: "Catalog", title: "Media & Image Library", href: "/admin/images", icon: Tag, keywords: ["photos", "uploads", "gallery", "media"] },
  { id: "nav-inventory", category: "Catalog", title: "Stock & Inventory Control", href: "/admin/inventory", icon: Package, keywords: ["stock", "variants", "sku", "adjust"] },
  { id: "nav-brands", category: "Catalog", title: "Manage Brands", href: "/admin/brands", icon: Tag, keywords: ["manufacturers", "logos"] },
  { id: "nav-categories", category: "Catalog", title: "Categories & Sub-Categories", href: "/admin/categories", icon: FolderTree, keywords: ["taxonomy", "hierarchy"] },
  { id: "nav-attributes", category: "Catalog", title: "Category Attributes", href: "/admin/attributes", icon: Sliders, keywords: ["specs", "variants", "options"] },
  { id: "nav-orders", category: "Orders", title: "Orders Management", href: "/admin/orders", icon: ShoppingBag, keywords: ["sales", "customers", "invoices"] },
  { id: "nav-leads", category: "Orders", title: "Solar Inquiries & Leads", href: "/admin/leads", icon: ShoppingBag, keywords: ["solar", "leads", "crm", "quotes"] },
  { id: "nav-coupons", category: "Orders", title: "Coupons & Discounts", href: "/admin/coupons", icon: Tag, keywords: ["promo", "discounts", "codes"] },
  { id: "nav-payments", category: "Orders", title: "Payments & Invoices", href: "/admin/payments", icon: CreditCard, keywords: ["money", "refunds", "transactions"] },
  { id: "nav-shipments", category: "Orders", title: "Shipments & Delivery", href: "/admin/shipments", icon: Truck, keywords: ["logistics", "courier", "awb"] },
  { id: "nav-tax", category: "System", title: "Tax & HSN Configuration", href: "/admin/tax", icon: FileText, keywords: ["gst", "rates", "hsn code"] },
  { id: "nav-units", category: "Catalog", title: "Units of Measure", href: "/admin/units", icon: Scale, keywords: ["uom", "piece", "kg", "units", "precision"] },
  { id: "nav-audit", category: "System", title: "Audit Log Trail", href: "/admin/audit", icon: History, keywords: ["security", "changes", "history"] },
  { id: "nav-settings", category: "System", title: "Store Settings", href: "/admin/settings", icon: Settings, keywords: ["config", "admin"] },
];

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Filter commands
  const filteredCommands = STATIC_COMMANDS.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  function handleSelect(item: CommandItem) {
    onClose();
    router.push(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredCommands[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in duration-100"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search and navigation"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-[var(--text-sm)]"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <Search size={18} className="text-[var(--color-fg-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search (products, orders, SKUs)…"
            className="flex-1 bg-transparent text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none text-[var(--text-base)]"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-fg-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-fg-muted)] text-[var(--text-xs)]">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-[var(--radius-md)] flex items-center justify-between gap-3 text-left transition-colors",
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                        : "text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-surface-sunken)] text-[var(--color-fg-muted)]"
                        )}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-[var(--text-sm)]">
                          {cmd.title}
                        </p>
                        {cmd.subtitle && (
                          <p className="text-[11px] text-[var(--color-fg-muted)] truncate">
                            {cmd.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-fg-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
                        {cmd.category}
                      </span>
                      {isSelected && <ArrowRight size={14} className="text-[var(--color-primary)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[var(--color-surface-sunken)] border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
          <span>
            Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd>
          </span>
          <span>
            Select with <kbd className="font-mono">↵</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
