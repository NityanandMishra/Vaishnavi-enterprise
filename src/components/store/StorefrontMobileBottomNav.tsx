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

export default function StorefrontMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface border-t border-border-base shadow-lg">
      <div className="flex items-stretch h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-brand-orange-600 font-bold"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
