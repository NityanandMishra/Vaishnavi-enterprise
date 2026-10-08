"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/search", label: "Search", icon: Search },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/account", label: "Account", icon: User },
];

/**
 * Mobile Bottom Navigation (§5.5)
 *
 * Fixed at bottom of mobile viewports (<1024px).
 * Exactly 5 items, 56px height + safe-area padding.
 * Uses aria-current="page" for accessibility and visual indicator.
 */
export default function StorefrontMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="foot-nav" aria-label="Mobile Navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(isActive && "text-[var(--accent-ink)]")}
          >
            <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
