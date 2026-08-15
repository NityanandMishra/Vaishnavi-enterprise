"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ImageIcon,
  Tag,
  FolderTree,
  ShoppingBag,
  MessageSquare,
  LogOut,
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/images", label: "Images", icon: ImageIcon },
  { href: "/admin/brands", label: "Brands", icon: Tag },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/leads", label: "Leads", icon: MessageSquare },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] h-screen bg-[#0F172A] flex flex-col py-6 sticky top-0 z-50 overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="px-6 mb-9" style={{ color: "var(--color-ink-inverse)" }}>
        <Logo size="md" emphasis />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-[2px]">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-6 py-[12px] cursor-pointer text-white transition-all font-sans text-sm font-medium",
                isActive
                  ? "border-l-[4px] border-[#EA580C] bg-[#1E293B] opacity-100"
                  : "border-l-[4px] border-transparent opacity-75 hover:opacity-100 hover:bg-[#1E293B]/50"
              )}
            >
              <Icon size={18} className="opacity-90" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 pt-5 mt-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-3 w-full text-left text-white opacity-75 hover:opacity-100 hover:text-red-400 transition-all font-sans text-sm font-medium"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
