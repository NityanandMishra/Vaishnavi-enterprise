"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, ShoppingCart, Heart, User, Menu, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
    <header className="sticky top-0 z-40 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 mr-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange-500 to-brand-orange-700 shadow-lg shadow-brand-orange-900/40">
            <Zap size={20} fill="white" color="white" />
          </div>
          <div className="hidden sm:block">
            <p className="font-heading font-bold text-base leading-tight text-white">Vaishnavi</p>
            <p className="text-[10px] text-slate-400 leading-tight tracking-widest uppercase">Enterprises</p>
          </div>
        </Link>

        {/* Desktop Category Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <Link href="/categories/electric-vehicles" className="hover:text-brand-orange-400 transition-colors">Electric Vehicles</Link>
          <Link href="/categories/fans" className="hover:text-brand-orange-400 transition-colors">Fans</Link>
          <Link href="/categories/led-lighting" className="hover:text-brand-orange-400 transition-colors">LED Lighting</Link>
          <Link href="/categories/ups-systems" className="hover:text-brand-orange-400 transition-colors">UPS & Backups</Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop Search Bar */}
        <form
          onSubmit={handleSearch}
          className={cn(
            "hidden md:flex items-center gap-2 bg-slate-800/60 border border-white/8 rounded-xl px-3 py-2 transition-all duration-300",
            searchOpen ? "ring-1 ring-brand-orange-500/50 w-72" : "w-52"
          )}
        >
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search products…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => !searchQuery && setSearchOpen(false)}
            className="bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none w-full"
          />
        </form>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Search"
          >
            <Search size={22} />
          </button>

          <Link
            href="/wishlist"
            className="hidden sm:flex p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Wishlist"
          >
            <Heart size={22} />
          </Link>

          <Link
            href="/cart"
            className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Cart"
          >
            <ShoppingCart size={22} />
          </Link>

          <Link
            href="/account"
            className="hidden sm:flex p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Account"
          >
            <User size={22} />
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3 border-b border-white/5">
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-slate-800/60 border border-white/8 rounded-xl px-3 py-2.5 ring-1 ring-brand-orange-500/50">
            <Search size={16} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none flex-1"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}>
                <X size={16} className="text-slate-500" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/5 glass">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {[
              { href: "/categories/electric-vehicles", label: "🛵 Electric Vehicles" },
              { href: "/categories/fans", label: "💨 Fans & Blowers" },
              { href: "/categories/led-lighting", label: "💡 LED Lighting" },
              { href: "/categories/ups-systems", label: "🔋 UPS & Power Backups" },
              { href: "/wishlist", label: "♥ Wishlist" },
              { href: "/account", label: "👤 My Account" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
