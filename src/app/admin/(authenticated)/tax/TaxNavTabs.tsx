"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderTree, Settings, Calculator, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaxNavTabsProps {
  unmappedCategoriesCount?: number;
  userRole?: string;
}

export default function TaxNavTabs({
  unmappedCategoriesCount = 0,
  userRole = "ADMIN",
}: TaxNavTabsProps) {
  const pathname = usePathname();

  const isSuperAdminOrFinance =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "FINANCE";

  const tabs = [
    {
      href: "/admin/tax/hsn",
      aliases: ["/admin/tax", "/config/tax", "/config/tax/hsn"],
      label: "HSN Codes & Rates",
      icon: FileText,
    },
    {
      href: "/admin/tax/mapping",
      aliases: ["/config/tax/mapping"],
      label: "Category Mapping",
      icon: FolderTree,
      badge: unmappedCategoriesCount > 0 ? unmappedCategoriesCount : undefined,
      badgeVariant: "warning" as const,
    },
    ...(isSuperAdminOrFinance
      ? [
          {
            href: "/admin/tax/settings",
            aliases: ["/config/tax/settings"],
            label: "Tax Settings",
            icon: Settings,
          },
        ]
      : []),
    {
      href: "/admin/tax/preview",
      aliases: ["/config/tax/preview"],
      label: "Tax Calculator",
      icon: Calculator,
    },
  ];

  return (
    <div className="border-b border-[var(--gray-200)] bg-white px-6 pt-4">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.aliases && tab.aliases.includes(pathname)) ||
            (tab.href !== "/admin/tax/hsn" && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 text-[var(--text-sm)] font-medium border-b-2 transition-all whitespace-nowrap",
                isActive
                  ? "border-[var(--blue-600)] text-[var(--blue-700)] font-semibold"
                  : "border-transparent text-[var(--gray-600)] hover:text-[var(--gray-900)] hover:border-[var(--gray-300)]"
              )}
            >
              <tab.icon
                size={16}
                className={isActive ? "text-[var(--blue-600)]" : "text-[var(--gray-500)]"}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--amber-100)] text-[var(--amber-800)] border border-[var(--amber-300)]">
                  {tab.badge} unmapped
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
