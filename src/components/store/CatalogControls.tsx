"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, ArrowUpDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name", label: "Name: A to Z" },
] as const;

export type BrandOption = { id: string; name: string; count: number };

/**
 * Category Listing Controls & Sidebar Facets (§6.2)
 *
 * Desktop (≥1024px): 264px sticky sidebar with facet groups (Brand, Availability, Sort).
 * Mobile (<1024px): Dual action bar (Filter | Sort By) opening bottom drawer sheet.
 */
export default function CatalogControls({
  brands,
}: {
  brands: BrandOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<"filter" | "sort" | null>(null);

  const activeSort = searchParams.get("sort") ?? "newest";
  const activeBrands = (searchParams.get("brand") ?? "").split(",").filter(Boolean);
  const activeAvail = searchParams.get("avail") ?? ""; // "stock" | "ask" | ""

  function apply(next: URLSearchParams) {
    next.delete("show");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setSort(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    apply(next);
    setSheet(null);
  }

  function toggleBrand(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    const set = new Set(activeBrands);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (set.size === 0) next.delete("brand");
    else next.set("brand", [...set].join(","));
    apply(next);
  }

  function toggleAvail(val: "stock" | "ask") {
    const next = new URLSearchParams(searchParams.toString());
    if (activeAvail === val) {
      next.delete("avail");
    } else {
      next.set("avail", val);
    }
    apply(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("brand");
    next.delete("avail");
    apply(next);
    setSheet(null);
  }

  const filterCount = activeBrands.length + (activeAvail ? 1 : 0);

  return (
    <>
      {/* ── Mobile Trigger Bar (<1024px) ───────────────────────────────── */}
      <div className="lg:hidden grid grid-cols-2 bg-[var(--surface)] border-y border-[var(--line)] sticky top-[var(--hdr)] z-30">
        <button
          onClick={() => setSheet("filter")}
          className="flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold uppercase tracking-wider text-[var(--fg)] hover:bg-[var(--mortar)] transition-colors"
        >
          <SlidersHorizontal size={16} />
          <span>Filters</span>
          {filterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSheet("sort")}
          className="flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold uppercase tracking-wider text-[var(--fg)] border-l border-[var(--line)] hover:bg-[var(--mortar)] transition-colors"
        >
          <ArrowUpDown size={16} />
          <span>Sort By</span>
        </button>
      </div>

      {/* ── Desktop Sticky Sidebar (≥1024px, 264px width) ───────────────── */}
      <aside className="hidden lg:block w-[264px] flex-shrink-0">
        <div className="sticky top-24 space-y-6 p-5 rounded bg-[var(--surface)] border border-[var(--line)]">
          {/* Header & Reset */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line-soft)]">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--fg)]">Filters</h3>
            {filterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--accent-ink)] font-semibold hover:underline"
              >
                Clear all ({filterCount})
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="fld">
            <label htmlFor="sort-desktop" className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Sort By
            </label>
            <select
              id="sort-desktop"
              value={activeSort}
              onChange={(e) => setSort(e.target.value)}
              className="inp text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Facet (§6.2: exactly two options) */}
          <div className="space-y-3 pt-3 border-t border-[var(--line-soft)]">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Availability
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-sm text-[var(--fg)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeAvail === "stock"}
                  onChange={() => toggleAvail("stock")}
                  className="w-4 h-4 rounded text-[var(--accent)] border-[var(--line)] focus:ring-[var(--accent)]"
                />
                <span className="font-medium">In stock now</span>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-[var(--fg)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeAvail === "ask"}
                  onChange={() => toggleAvail("ask")}
                  className="w-4 h-4 rounded text-[var(--accent)] border-[var(--line)] focus:ring-[var(--accent)]"
                />
                <span className="font-medium">Order to size</span>
              </label>
            </div>
          </div>

          {/* Brand Facet */}
          {brands.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-[var(--line-soft)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Brand / Manufacturer
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {brands.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center justify-between text-sm text-[var(--fg)] cursor-pointer select-none py-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={activeBrands.includes(b.id)}
                        onChange={() => toggleBrand(b.id)}
                        className="w-4 h-4 rounded text-[var(--accent)] border-[var(--line)] focus:ring-[var(--accent)]"
                      />
                      <span className="truncate">{b.name}</span>
                    </div>
                    <span className="text-xs text-[var(--fg-quiet)] ml-2">({b.count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile Filter Bottom Sheet ─────────────────────────────────── */}
      {sheet === "filter" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end lg:hidden">
          <div className="bg-[var(--surface)] w-full max-h-[85vh] rounded-t-xl p-6 overflow-y-auto animate-in slide-in-from-bottom flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
              <h3 className="font-bold text-base text-[var(--fg)]">Filters</h3>
              <button onClick={() => setSheet(null)} className="ib" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Availability */}
            <div className="mb-6">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--fg-quiet)] mb-3">
                Availability
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAvail("stock")}
                  className={cn("tag", activeAvail === "stock" && "active")}
                  aria-pressed={activeAvail === "stock"}
                >
                  In stock now
                </button>
                <button
                  type="button"
                  onClick={() => toggleAvail("ask")}
                  className={cn("tag", activeAvail === "ask" && "active")}
                  aria-pressed={activeAvail === "ask"}
                >
                  Order to size
                </button>
              </div>
            </div>

            {/* Brands */}
            {brands.length > 0 && (
              <div className="mb-6">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--fg-quiet)] mb-3">
                  Brand
                </h4>
                <div className="space-y-3">
                  {brands.map((b) => (
                    <label key={b.id} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={activeBrands.includes(b.id)}
                          onChange={() => toggleBrand(b.id)}
                          className="w-5 h-5 rounded text-[var(--accent)]"
                        />
                        <span className="font-medium text-[var(--fg)]">{b.name}</span>
                      </div>
                      <span className="text-xs text-[var(--fg-quiet)]">({b.count})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-[var(--line)] flex gap-3">
              <button onClick={clearFilters} className="act act-line flex-1">
                Clear
              </button>
              <button onClick={() => setSheet(null)} className="act act-fill flex-1">
                Done ({filterCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Sort Bottom Sheet ───────────────────────────────────── */}
      {sheet === "sort" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end lg:hidden">
          <div className="bg-[var(--surface)] w-full rounded-t-xl p-6 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
              <h3 className="font-bold text-base text-[var(--fg)]">Sort Products</h3>
              <button onClick={() => setSheet(null)} className="ib" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1 mb-6">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSort(o.value)}
                  className="w-full flex items-center justify-between py-3 px-2 text-sm text-[var(--fg)] text-left hover:bg-[var(--mortar)] rounded"
                >
                  <span className={cn(activeSort === o.value && "font-bold text-[var(--accent-ink)]")}>
                    {o.label}
                  </span>
                  {activeSort === o.value && <Check size={18} className="text-[var(--accent-ink)]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
