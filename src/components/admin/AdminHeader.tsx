"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  User,
  Settings,
  LogOut,
  AlertTriangle,
  Package,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_BADGE_STYLE } from "@/lib/types/admin";
import CommandPalette from "./CommandPalette";

interface AdminHeaderProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  onOpenMobileMenu?: () => void;
}

export default function AdminHeader({
  user,
  onOpenMobileMenu,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate Breadcrumbs based on path
  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1) {
      return [{ label: "Dashboard", href: "/admin" }];
    }

    const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
    let currentPath = "/admin";

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      currentPath += `/${seg}`;

      let label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
      if (seg === "products") label = "Products";
      if (seg === "categories") label = "Categories";
      if (seg === "brands") label = "Brands";
      if (seg === "orders") label = "Orders";
      if (seg === "inventory") label = "Inventory";
      if (seg === "attributes") label = "Attributes";
      if (seg === "tax") label = "Tax & HSN";
      if (seg === "audit") label = "Audit Log";

      crumbs.push({ label, href: i === segments.length - 1 ? undefined : currentPath });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const userRole = user?.role || "SUPER_ADMIN";
  const roleLabel = ROLE_LABELS[userRole] || "Super Admin";
  const roleBadgeStyle = ROLE_BADGE_STYLE[userRole] || {
    bg: "var(--violet-50)",
    text: "var(--violet-600)",
  };

  // Mock actionable notifications
  const notifications = [
    {
      id: "1",
      title: "Low stock alert",
      message: "3 SKUs are below the reorder threshold (Polycab 2.5mm wire)",
      href: "/admin/inventory?filter=low_stock",
      time: "10m ago",
      icon: AlertTriangle,
      iconColor: "text-[var(--amber-600)]",
    },
    {
      id: "2",
      title: "New order received",
      message: "Order #ORD-8429 requires fulfilment confirmation",
      href: "/admin/orders",
      time: "25m ago",
      icon: ShoppingBag,
      iconColor: "text-[var(--blue-600)]",
    },
  ];

  return (
    <>
      <header className="h-[var(--topbar-height)] bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 flex-shrink-0">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="lg:hidden w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] focus:outline-none"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Breadcrumb Bar */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-fg-muted)] truncate"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight size={12} className="text-[var(--color-fg-subtle)] flex-shrink-0" />}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[var(--color-fg)] transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn("truncate font-medium", isLast && "text-[var(--color-fg)] font-semibold")}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Search ⌘K + Notifications + Avatar Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
          {/* Global Command Search (⌘K / Ctrl+K) */}
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            aria-label="Search and commands (Ctrl+K)"
            className="hidden sm:inline-flex items-center gap-2 h-[var(--input-height)] px-3 rounded-[var(--input-radius)] border border-[var(--input-border)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-fg-muted)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
          >
            <Search size={14} className="text-[var(--color-fg-subtle)]" />
            <span>Search admin…</span>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-fg-muted)] shadow-[var(--shadow-sm)]">
              ⌘K
            </kbd>
          </button>

          {/* Notifications Bell */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label="Notifications"
              aria-expanded={isNotifOpen}
              className="relative w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
            >
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-danger)] ring-2 ring-white" />
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-[var(--text-sm)]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-fg)] text-[var(--text-sm)]">
                    Notifications
                  </span>
                  <span className="text-[11px] font-bold text-[var(--color-primary)]">
                    {notifications.length} new
                  </span>
                </div>

                <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => setIsNotifOpen(false)}
                        className="p-3 flex items-start gap-3 hover:bg-[var(--color-surface-sunken)] transition-colors block"
                      >
                        <div className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] flex-shrink-0 mt-0.5">
                          <Icon size={15} className={n.iconColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[var(--text-xs)] font-semibold text-[var(--color-fg)]">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-[var(--color-fg-muted)] mt-0.5 leading-snug">
                            {n.message}
                          </p>
                          <span className="text-[10px] font-mono text-[var(--color-fg-subtle)] mt-1 block">
                            {n.time}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Storefront Quick Link */}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="View Storefront in new tab"
            className="hidden md:inline-flex items-center gap-1 text-[var(--text-xs)] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <span>Store</span>
            <ExternalLink size={12} />
          </Link>

          {/* Avatar Menu */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              aria-label="User profile menu"
              aria-expanded={isProfileOpen}
              className="flex items-center gap-2 p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--blue-50)] text-[var(--blue-700)] border border-[var(--blue-200)] flex items-center justify-center font-bold text-[var(--text-xs)] select-none">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[var(--text-xs)] font-bold text-[var(--color-fg)] block leading-none">
                  {user?.name || "Administrator"}
                </span>
                <span
                  style={{ backgroundColor: roleBadgeStyle.bg, color: roleBadgeStyle.text }}
                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded mt-0.5 inline-block leading-tight"
                >
                  {roleLabel}
                </span>
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] z-40 py-1 text-[var(--text-sm)] animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-[var(--color-border)]">
                  <p className="font-semibold text-[var(--color-fg)] text-[var(--text-xs)]">
                    {user?.name || "Administrator"}
                  </p>
                  <p className="text-[11px] text-[var(--color-fg-muted)] truncate">
                    {user?.email || "admin@vaishnavienterprises.in"}
                  </p>
                  <div className="mt-1.5">
                    <span
                      style={{ backgroundColor: roleBadgeStyle.bg, color: roleBadgeStyle.text }}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    >
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <Link
                  href="/admin/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="px-3 py-2 flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-fg)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                >
                  <Settings size={14} className="text-[var(--color-fg-muted)]" />
                  <span>Store Settings</span>
                </Link>

                <div className="border-t border-[var(--color-border)] my-1" />

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="w-full px-3 py-2 flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-colors text-left font-medium"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global ⌘K Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </>
  );
}
