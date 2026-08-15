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
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PINNED_LIMIT, type NavCategory } from "@/lib/nav";

/**
 * Storefront header.
 *
 * The bar renders a fixed number of inline slots — one mega-menu trigger plus
 * at most PINNED_LIMIT category links — so its height cannot change with the
 * size of the catalogue. Listing every category inline was not an option:
 * measured at 1280px the bar has ~725px of free width while the ten current
 * top-level categories need ~1189px, so they would wrap and grow the header.
 * Everything beyond the pinned few lives in the mega-menu instead.
 */
export default function StorefrontHeader({ categories }: { categories: NavCategory[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const pinned = categories.slice(0, PINNED_LIMIT);

  // Close both menus whenever navigation happens.
  useEffect(() => {
    setMegaOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!megaOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMegaOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
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
    <header className="sticky top-0 z-chrome bg-surface border-b border-border-base shadow-sm">
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
        <Link href="/" aria-label="Vaishnavi Enterprises — home" className="flex-shrink-0 md:mr-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Vaishnavi Enterprises" className="h-10 w-auto object-contain" />
        </Link>

        {/* Desktop nav — a fixed number of slots, never the whole catalogue */}
        {categories.length > 0 && (
          <nav className="hidden md:flex items-center gap-1 min-w-0" ref={megaRef}>
            <button
              type="button"
              onClick={() => setMegaOpen((o) => !o)}
              aria-expanded={megaOpen}
              aria-controls="mega-menu"
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-semibold transition-colors",
                megaOpen
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-surface-alt hover:text-slate-900"
              )}
            >
              <LayoutGrid size={16} />
              Categories
              <ChevronDown
                size={15}
                className={cn("transition-transform", megaOpen && "rotate-180")}
              />
            </button>

            {pinned.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                // Capped and truncated so a long category name can never push
                // the row to a second line.
                className="hidden lg:block flex-shrink-0 max-w-[150px] truncate h-9 leading-9 px-3 rounded-md text-sm font-medium text-slate-600 hover:bg-surface-alt hover:text-slate-900 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        )}

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

      {/* Mega-menu — grows downward as a panel, never affecting the bar */}
      {megaOpen && (
        <div
          id="mega-menu"
          className="hidden md:block absolute left-0 right-0 top-full bg-surface border-b border-border-base shadow-lg"
        >
          <div className="max-w-content mx-auto px-4 lg:px-8 py-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
              {categories.map((cat) => (
                <div key={cat.id} className="min-w-0">
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="block text-sm font-bold text-slate-900 hover:text-brand-orange-600 transition-colors mb-2 truncate"
                  >
                    {cat.name}
                  </Link>
                  {cat.children.length > 0 ? (
                    <ul className="space-y-1.5">
                      {cat.children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/categories/${sub.slug}`}
                            className="block text-sm text-slate-600 hover:text-brand-orange-600 transition-colors truncate"
                          >
                            {sub.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">Browse all items</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border-base">
              <Link
                href="/categories"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-brand-orange-600 transition-colors"
              >
                View all categories
              </Link>
            </div>
          </div>
        </div>
      )}

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

      {/* Mobile drawer — scrolls, so category count is unconstrained here */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border-base bg-surface max-h-[75vh] overflow-y-auto">
          <nav className="flex flex-col px-4 py-3">
            {categories.map((cat) => (
              <div key={cat.id} className="border-b border-border-base last:border-0 py-1">
                <Link
                  href={`/categories/${cat.slug}`}
                  className="block py-3 px-3 -mx-1 text-sm font-semibold text-slate-900 hover:bg-surface-alt rounded-md transition-colors"
                >
                  {cat.name}
                </Link>
                {cat.children.length > 0 && (
                  <ul className="pb-2">
                    {cat.children.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/categories/${sub.slug}`}
                          className="block py-2.5 pl-6 pr-3 -mx-1 text-sm text-slate-600 hover:bg-surface-alt rounded-md transition-colors"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {[
              { href: "/categories", label: "All Categories" },
              { href: "/wishlist", label: "Wishlist" },
              { href: "/account", label: "My Account" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="py-3 px-3 -mx-1 mt-1 text-sm font-medium text-slate-700 hover:bg-surface-alt rounded-md transition-colors"
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
