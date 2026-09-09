"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Layers,
  Package,
  Tag,
  FolderTree,
  Sliders,
  Boxes,
  ClipboardList,
  AlertTriangle,
  ShoppingBag,
  CreditCard,
  Truck,
  Scale,
  FileText,
  MapPin,
  Settings,
  History,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ImageIcon,
  MessageSquare,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number | string;
  badgeVariant?: "warning" | "primary" | "danger";
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export default function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
  className,
}: AdminSidebarProps) {
  const pathname = usePathname();

  // Collapsible groups state persisted in localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin_nav_groups");
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return {};
  });

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem("admin_nav_groups", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }

  const NAV_GROUPS: NavGroup[] = [
    {
      id: "catalog",
      label: "CATALOG",
      items: [
        { href: "/admin/products", label: "Products", icon: Package },
        { href: "/admin/categories", label: "Categories", icon: FolderTree },
        { href: "/admin/brands", label: "Brands", icon: Tag },
        { href: "/admin/images", label: "Media Library", icon: ImageIcon },
        { href: "/admin/attributes", label: "Attributes", icon: Sliders },
      ],
    },
    {
      id: "inventory",
      label: "INVENTORY",
      items: [
        { href: "/admin/inventory", label: "Stock Overview", icon: Boxes },
        { href: "/admin/inventory/low-stock", label: "Low Stock Queue", icon: AlertTriangle, badge: "Queue", badgeVariant: "warning" },
        { href: "/admin/inventory/movements", label: "Movements Ledger", icon: ClipboardList },
        { href: "/admin/inventory/bulk", label: "Bulk Stock Update", icon: Layers },
      ],
    },
    {
      id: "sales",
      label: "SALES & CRM",
      items: [
        { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: 12, badgeVariant: "primary" },
        { href: "/admin/leads", label: "Solar Inquiries", icon: MessageSquare },
        { href: "/admin/coupons", label: "Coupons", icon: Tag },
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
        { href: "/admin/shipments", label: "Shipments", icon: Truck },
      ],
    },
    {
      id: "config",
      label: "CONFIGURATION",
      items: [
        { href: "/admin/units", label: "Units & Measures", icon: Scale },
        { href: "/admin/tax", label: "Tax & HSN", icon: FileText },
        { href: "/admin/shipping-zones", label: "Shipping Zones", icon: MapPin },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen bg-[var(--gray-900)] text-white flex flex-col sticky top-0 z-40 border-r border-[var(--gray-800)] select-none transition-all duration-200 flex-shrink-0",
        isCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
        className
      )}
    >
      {/* ── Brand Header ─────────────────────────────────────────────────── */}
      <div className="h-[var(--topbar-height)] px-4 flex items-center justify-between border-b border-[var(--gray-800)] flex-shrink-0">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 min-w-0 overflow-hidden focus:outline-none"
        >
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center font-bold text-white text-[var(--text-sm)] flex-shrink-0">
            VE
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-bold text-[var(--text-sm)] tracking-tight block truncate text-white">
                Vaishnavi
              </span>
              <span className="text-[10px] text-[var(--gray-400)] tracking-wider uppercase block -mt-1">
                Admin Portal
              </span>
            </div>
          )}
        </Link>

        {onToggleCollapse && !isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--gray-400)] hover:text-white hover:bg-[var(--gray-800)] transition-colors focus:outline-none"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* ── Navigation Tree ──────────────────────────────────────────────── */}
      <nav
        aria-label="Admin Navigation"
        className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar"
      >
        {/* Dashboard Link (Flat Top) */}
        <div>
          <NavLink
            href="/admin"
            label="Dashboard"
            icon={Layers}
            exact
            isCollapsed={isCollapsed}
            isActive={pathname === "/admin"}
          />
        </div>

        {/* Grouped Sections */}
        {NAV_GROUPS.map((group) => {
          const isGroupCollapsed = collapsedGroups[group.id] && !isCollapsed;

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header */}
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full px-2.5 py-1 flex items-center justify-between text-[11px] font-bold tracking-[0.05em] uppercase text-[var(--gray-400)] hover:text-white transition-colors text-left"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "transition-transform text-[var(--gray-500)]",
                      isGroupCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {/* Group Items */}
              {(!isGroupCollapsed || isCollapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href.split("?")[0]);

                    return (
                      <NavLink
                        key={item.href}
                        {...item}
                        isActive={isActive}
                        isCollapsed={isCollapsed}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="p-2 border-t border-[var(--gray-800)] space-y-0.5 flex-shrink-0 bg-[var(--gray-900)]">
        <NavLink
          href="/admin/settings"
          label="Settings"
          icon={Settings}
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith("/admin/settings")}
        />
        <NavLink
          href="/admin/audit"
          label="Audit Log"
          icon={History}
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith("/admin/audit")}
        />

        {isCollapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="w-full h-9 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--gray-400)] hover:text-white hover:bg-[var(--gray-800)] transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          title={isCollapsed ? "Sign out" : undefined}
          className={cn(
            "w-full h-9 px-3 rounded-[var(--radius-md)] flex items-center gap-2.5 text-[var(--text-xs)] font-medium text-[var(--gray-400)] hover:text-[var(--color-danger)] hover:bg-[var(--gray-800)] transition-colors text-left",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  badgeVariant = "primary",
  isActive,
  isCollapsed,
}: NavItem & { isActive: boolean; isCollapsed: boolean }) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 h-9 px-3 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium transition-all",
        isActive
          ? "bg-[var(--blue-800)] text-white font-semibold shadow-sm"
          : "text-[var(--gray-300)] hover:text-white hover:bg-[var(--gray-800)]",
        isCollapsed && "justify-center px-0"
      )}
    >
      {/* 3px Active Indicator Stripe on left per Spec 00 (5.1) */}
      {isActive && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[var(--color-primary)] rounded-r"
          aria-hidden="true"
        />
      )}

      <Icon
        size={16}
        className={cn(
          "flex-shrink-0 transition-colors",
          isActive ? "text-[var(--blue-400)]" : "text-[var(--gray-400)] group-hover:text-white"
        )}
      />

      {!isCollapsed && (
        <span className="truncate flex-1 min-w-0">{label}</span>
      )}

      {!isCollapsed && badge !== undefined && badge !== null && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-[var(--radius-full)] text-[10px] font-mono font-bold leading-none",
            badgeVariant === "warning"
              ? "bg-[var(--amber-600)] text-white"
              : badgeVariant === "danger"
              ? "bg-[var(--red-600)] text-white"
              : "bg-[var(--color-primary)] text-white"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
