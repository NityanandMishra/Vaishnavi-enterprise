"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  LayoutGrid,
  Phone,
  Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavCategory } from "@/lib/nav";
import ComingSoonTag from "./ComingSoonTag";

export default function StorefrontHeader({ categories }: { categories: NavCategory[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close menus on page navigation
  useEffect(() => {
    setMegaOpen(false);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [pathname]);

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setMegaOpen(false);
  };

  useEffect(() => {
    if (!megaOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMegaOpen(false);
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = megaRef.current?.contains(target);
      const insidePanel = megaPanelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) setMegaOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [megaOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  return (
    <header className="top shadow-sm">
      <div className="wrap">
        <div className="top-in">
          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ib m-only"
            aria-label="Open Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Brand Mark (§5.5) */}
          <Link href="/" className="mark flex-shrink-0" onClick={closeMenus}>
            <div className="w-9 h-9 rounded bg-[var(--accent)] text-white flex items-center justify-center font-bold flex-shrink-0">
              <Zap size={20} className="fill-white" />
            </div>
            <div className="min-w-0">
              <b className="tracking-tight">VAISHNAVI</b>
              <small>SURIYAWAN · BHADOHI</small>
            </div>
          </Link>

          {/* Desktop Navigation Links (Max 4 links as specified in §5.5) */}
          <nav className="topnav" ref={megaRef}>
            <button
              type="button"
              onClick={() => setMegaOpen((o) => !o)}
              aria-expanded={megaOpen}
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--fg)] hover:text-[var(--accent-ink)]"
            >
              <LayoutGrid size={16} />
              <span>Categories</span>
              <ChevronDown
                size={14}
                className={cn("transition-transform duration-200", megaOpen && "rotate-180")}
              />
            </button>

            <Link
              href="/categories/fans"
              className={cn(pathname.includes("/fans") && "active")}
            >
              Fans & Electricals
            </Link>

            <Link
              href="/solar"
              className={cn(pathname.includes("/solar") && "active")}
            >
              Solar Rooftop
            </Link>

            <Link
              href="/categories/electric-vehicles"
              className={cn(pathname.includes("/electric-vehicles") && "active")}
            >
              E-Vehicles (Inquire)
            </Link>
          </nav>

          {/* Inline Search (≥768px, §5.5) */}
          <div className="find">
            <Search size={18} />
            <form onSubmit={handleSearch} className="w-full">
              <input
                type="search"
                placeholder="Search wires, fans, lights, UPS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search catalogue"
              />
            </form>
          </div>

          {/* Action Controls */}
          <div className="top-acts">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="ib md:hidden"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            <Link href="/wishlist" className="ib d-only" aria-label="Saved Items">
              <Heart size={20} />
            </Link>

            <Link href="/cart" className="ib relative" aria-label="Shopping Cart">
              <ShoppingCart size={20} />
            </Link>

            <Link href="/account" className="ib d-only" aria-label="Account">
              <User size={20} />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Search Input Drawer (when toggled on small screens) */}
      {searchOpen && (
        <div className="md:hidden border-t border-[var(--line)] bg-[var(--surface)] p-3">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="search"
              autoFocus
              placeholder="Search catalogue by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="inp"
            />
          </form>
        </div>
      )}

      {/* Mega-Menu Panel (§5.5) */}
      {megaOpen && (
        <div
          id="mega-menu"
          ref={megaPanelRef}
          className="absolute left-0 right-0 top-full bg-[var(--surface)] border-b border-[var(--line)] shadow-lg z-50 animate-in fade-in slide-in-from-top-1"
        >
          <div className="wrap py-8 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {categories.map((cat) => (
                <div key={cat.id} className="min-w-0">
                  <Link
                    href={`/categories/${cat.slug}`}
                    onClick={closeMenus}
                    className="block font-bold text-[15px] text-[var(--fg)] hover:text-[var(--accent-ink)] transition-colors mb-2 truncate"
                  >
                    {cat.name}
                  </Link>
                  {cat.children && cat.children.length > 0 ? (
                    <ul className="space-y-1.5">
                      {cat.children.map((sub) => (
                        <li key={sub.id}>
                          {sub.comingSoon ? (
                            <span className="flex items-center gap-1.5 text-xs text-[var(--fg-quiet)]">
                              <span className="truncate">{sub.name}</span>
                              <ComingSoonTag />
                            </span>
                          ) : (
                            <Link
                              href={`/categories/${sub.slug}`}
                              onClick={closeMenus}
                              className="block text-xs text-[var(--fg-muted)] hover:text-[var(--accent-ink)] truncate"
                            >
                              {sub.name}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[var(--fg-quiet)]">Browse catalogue</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between">
              <Link
                href="/categories"
                onClick={closeMenus}
                className="font-semibold text-sm text-[var(--accent-ink)] hover:underline"
              >
                View all trade categories →
              </Link>
              <div className="text-xs text-[var(--fg-quiet)]">
                Local Pickup & Authorised Warranty in Suriyawan, Bhadohi
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[var(--hdr)] z-40 bg-black/40 backdrop-blur-xs md:hidden">
          <div className="bg-[var(--surface)] w-4/5 max-w-sm h-full p-6 overflow-y-auto shadow-2xl flex flex-col">
            <div className="font-bold text-xs uppercase tracking-wider text-[var(--fg-quiet)] mb-3">
              Shop Categories
            </div>
            <div className="space-y-2 mb-6">
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  onClick={closeMenus}
                  className="block py-2 text-sm font-semibold text-[var(--fg)] hover:text-[var(--accent-ink)] border-b border-[var(--line-soft)]"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/categories"
                onClick={closeMenus}
                className="block py-2 text-sm font-bold text-[var(--accent-ink)]"
              >
                All 9 Categories →
              </Link>
            </div>

            <div className="font-bold text-xs uppercase tracking-wider text-[var(--fg-quiet)] mb-3">
              Quick Links
            </div>
            <div className="space-y-2 mb-6">
              <Link
                href="/solar"
                onClick={closeMenus}
                className="block py-1.5 text-sm font-medium text-[var(--fg)]"
              >
                Solar Rooftop Assessment
              </Link>
              <Link
                href="/wishlist"
                onClick={closeMenus}
                className="block py-1.5 text-sm font-medium text-[var(--fg)]"
              >
                Saved Wishlist
              </Link>
              <Link
                href="/account"
                onClick={closeMenus}
                className="block py-1.5 text-sm font-medium text-[var(--fg)]"
              >
                My Account & Orders
              </Link>
            </div>

            <div className="mt-auto pt-4 border-t border-[var(--line)] text-xs text-[var(--fg-muted)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--fg)] font-semibold">
                <Phone size={14} className="text-[var(--accent)]" />
                <span>+91 73888 47575</span>
              </div>
              <p>Station Road, Suriyawan, Bhadohi, UP</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
