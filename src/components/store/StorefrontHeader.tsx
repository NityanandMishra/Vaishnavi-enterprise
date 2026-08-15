"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, ShoppingCart, Heart, User, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Logo from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const categoryNav = [
  { href: "/categories/electric-vehicles", label: "Electric Vehicles" },
  { href: "/categories/fans", label: "Fans" },
  { href: "/categories/led-lighting", label: "LED Lighting" },
  { href: "/categories/ups-systems", label: "UPS & Backups" },
  { href: "/categories", label: "All Categories" },
];

export default function StorefrontHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border-base shadow-sm">
      <div className="max-w-content mx-auto px-4 lg:px-8 h-16 flex items-center gap-4">

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden -ml-2 p-2.5 text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <Link
          href="/"
          aria-label="Vaishnavi Enterprises — home"
          className="ve-logo-link flex-shrink-0 md:mr-4"
          style={{ color: "var(--color-ink)" }}
        >
          <Logo size="md" />
        </Link>

        {/* Desktop Category Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {categoryNav.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-brand-orange-600 transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Desktop Search Bar */}
        <form
          onSubmit={handleSearch}
          className={cn(
            "hidden lg:flex items-center gap-2 bg-surface-alt border border-border-base rounded-md px-3 py-2 transition-all duration-300",
            searchOpen ? "ring-2 ring-slate-900 w-72" : "w-52"
          )}
        >
          <Search size={16} className="text-muted flex-shrink-0" />
          <input
            type="text"
            placeholder="Search products…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => !searchQuery && setSearchOpen(false)}
            className="bg-transparent text-sm text-slate-900 placeholder-muted outline-none w-full"
          />
        </form>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="lg:hidden p-2.5 text-slate-700 hover:text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
            aria-label="Search"
          >
            <Search size={22} />
          </button>

          <Link
            href="/wishlist"
            className="hidden sm:flex p-2.5 text-slate-700 hover:text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
            aria-label="Wishlist"
          >
            <Heart size={22} />
          </Link>

          <Link
            href="/cart"
            className="p-2.5 text-slate-700 hover:text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart size={22} />
          </Link>

          <Link
            href="/account"
            className="hidden sm:flex p-2.5 text-slate-700 hover:text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
            aria-label="Account"
          >
            <User size={22} />
          </Link>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="lg:hidden px-4 pb-3 border-b border-border-base">
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-surface-alt border border-border-base rounded-md px-3 py-2.5 ring-2 ring-slate-900">
            <Search size={16} className="text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Search products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="bg-transparent text-sm text-slate-900 placeholder-muted outline-none flex-1"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">
                <X size={16} className="text-muted" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border-base bg-surface">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {[...categoryNav, { href: "/wishlist", label: "Wishlist" }, { href: "/account", label: "My Account" }].map(
              ({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
                >
                  {label}
                </Link>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
