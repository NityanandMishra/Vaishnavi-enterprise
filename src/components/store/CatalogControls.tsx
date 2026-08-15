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

export default function CatalogControls({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<"filter" | "sort" | null>(null);

  const activeSort = searchParams.get("sort") ?? "newest";
  const activeBrands = (searchParams.get("brand") ?? "").split(",").filter(Boolean);

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

  function clearFilters() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("brand");
    apply(next);
    setSheet(null);
  }

  const filterCount = activeBrands.length;

  return (
    <>
      {/* Mobile trigger bar — matches the wireframe's FILTER | SORT BY split */}
      <div className="lg:hidden grid grid-cols-2 bg-surface border-y border-border-base sticky top-16 z-30">
        <button
          onClick={() => setSheet("filter")}
          className="flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold uppercase tracking-wide text-slate-900 hover:bg-surface-alt transition-colors"
        >
          <SlidersHorizontal size={16} />
          Filter
          {filterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-brand-orange-600 text-white text-[11px] font-bold flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSheet("sort")}
          className="flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold uppercase tracking-wide text-slate-900 border-l border-border-base hover:bg-surface-alt transition-colors"
        >
          <ArrowUpDown size={16} />
          Sort By
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 flex-shrink-0">
        <div className="sticky top-24 space-y-6">
          <div>
            <label htmlFor="sort-select" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Sort By
            </label>
            <select
              id="sort-select"
              value={activeSort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-surface border border-border-base rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {brands.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Brand</h3>
                {filterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs font-medium text-brand-orange-600 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {brands.map((b) => (
                  <li key={b.id}>
                    <button
                      onClick={() => toggleBrand(b.id)}
                      className="w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-md text-left text-sm text-slate-700 hover:bg-surface-alt transition-colors"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                          activeBrands.includes(b.id)
                            ? "bg-slate-900 border-slate-900"
                            : "border-border-base bg-surface"
                        )}
                      >
                        {activeBrands.includes(b.id) && <Check size={12} className="text-white" />}
                      </span>
                      <span className="flex-1 truncate">{b.name}</span>
                      <span className="text-xs text-muted">{b.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile bottom sheet */}
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSheet(null)}
            aria-label="Close"
          />
          <div className="relative w-full bg-surface rounded-t-xl max-h-[75vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-surface flex items-center justify-between px-4 py-4 border-b border-border-base">
              <h2 className="text-base font-semibold text-slate-900">
                {sheet === "filter" ? "Filter" : "Sort By"}
              </h2>
              <button onClick={() => setSheet(null)} className="p-2 -mr-2 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 pb-8">
              {sheet === "sort" ? (
                <ul className="space-y-1">
                  {SORT_OPTIONS.map((o) => (
                    <li key={o.value}>
                      <button
                        onClick={() => setSort(o.value)}
                        className={cn(
                          "w-full flex items-center justify-between min-h-[48px] px-3 rounded-md text-left text-sm transition-colors",
                          activeSort === o.value
                            ? "bg-surface-alt font-bold text-slate-900"
                            : "text-slate-700 hover:bg-surface-alt"
                        )}
                      >
                        {o.label}
                        {activeSort === o.value && <Check size={18} className="text-brand-orange-600" />}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : brands.length === 0 ? (
                <p className="text-sm text-slate-600 py-4">No brands available for this selection.</p>
              ) : (
                <>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Brand</h3>
                  <ul className="space-y-1">
                    {brands.map((b) => (
                      <li key={b.id}>
                        <button
                          onClick={() => toggleBrand(b.id)}
                          className="w-full flex items-center gap-3 min-h-[48px] px-3 -mx-1 rounded-md text-left text-sm text-slate-700 hover:bg-surface-alt transition-colors"
                        >
                          <span
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
                              activeBrands.includes(b.id)
                                ? "bg-slate-900 border-slate-900"
                                : "border-border-base bg-surface"
                            )}
                          >
                            {activeBrands.includes(b.id) && <Check size={13} className="text-white" />}
                          </span>
                          <span className="flex-1">{b.name}</span>
                          <span className="text-xs text-muted">{b.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {filterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 w-full min-h-[48px] rounded-md border border-border-base text-sm font-bold uppercase tracking-wide text-slate-900 hover:bg-surface-alt transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
