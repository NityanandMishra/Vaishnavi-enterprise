import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  productCardInclude,
  toProductCardData,
  catalogOrderBy,
  catalogTake,
  brandFilter,
  wishlistedProductIds,
  PAGE_SIZE,
  type CatalogSearchParams,
} from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import CatalogControls from "@/components/store/CatalogControls";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "Catalogue Search | Vaishnavi Enterprises",
  description: "Search authentic electrical switchgear, wires, fans, inverters, and solar hardware.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: CatalogSearchParams;
}) {
  const query = (searchParams.q ?? "").trim();
  const selectedBrands = brandFilter(searchParams.brand);
  const take = catalogTake(searchParams.show);

  const where: any = {
    isAvailable: true,
    status: "ACTIVE",
    deletedAt: null,
    ...(query && {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { shortDescription: { contains: query } },
      ],
    }),
    ...(selectedBrands.length > 0 && { brandId: { in: selectedBrands } }),
  };

  const [products, totalCount, brandRecords] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: catalogOrderBy(searchParams.sort),
      take,
      include: productCardInclude,
    }),
    prisma.product.count({ where }),
    prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            products: {
              where: { isAvailable: true, status: "ACTIVE", deletedAt: null },
            },
          },
        },
      },
    }),
  ]);

  const brands = brandRecords
    .filter((b) => b._count.products > 0)
    .map((b) => ({
      id: b.id,
      name: b.name,
      count: b._count.products,
    }));

  const wishlisted = await wishlistedProductIds(products.map((p) => p.id));
  const hasMore = totalCount > products.length;

  const nextShowParams = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string") as [string, string][]
  );
  nextShowParams.set("show", String(take + PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="wrap pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search Catalogue" }]} />

        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-4 mb-6 border-b border-[var(--line)] pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight">
              {query ? `Results for “${query}”` : "All Trade Hardware"}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--fg-muted)] mt-1">
              Commercial-grade electrical apparatus, wiring, power backup, and climate control.
            </p>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[var(--fg-muted)] fig">
            {totalCount} products found
          </span>
        </div>

        <div className="lg:flex lg:gap-8 items-start">
          <CatalogControls brands={brands} />

          <main className="flex-1 min-w-0 mt-6 lg:mt-0">
            {products.length === 0 ? (
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-12 text-center max-w-lg mx-auto my-8 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[var(--mortar)] flex items-center justify-center mx-auto text-[var(--fg-quiet)]">
                  <SearchX size={24} />
                </div>
                <h2 className="text-lg font-bold text-[var(--fg)]">No matching products found</h2>
                <p className="text-sm text-[var(--fg-muted)]">
                  {query
                    ? `We could not find anything matching “${query}”. Check the spelling or browse our department categories.`
                    : "There are currently no products matching your selected filters."}
                </p>
                <div className="pt-2">
                  <Link href="/" className="act act-fill">
                    Browse All Categories
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* ── Fixed Slot Catalogue Grid (§5.2) ───────────────────── */}
                <div className="cat">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={toProductCardData(product, {
                        wishlisted: wishlisted.has(product.id),
                      })}
                    />
                  ))}
                </div>

                {/* ── Pagination / Load More (§6.2) ─────────────────────── */}
                <div className="mt-10 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-[var(--fg-muted)]">
                    Showing <span className="font-bold text-[var(--fg)] fig">{products.length}</span> of{" "}
                    <span className="font-bold text-[var(--fg)] fig">{totalCount}</span> products
                  </p>
                  {hasMore && (
                    <Link
                      href={`/search?${nextShowParams.toString()}`}
                      className="act act-line act-big px-10 text-sm font-bold uppercase tracking-wider"
                    >
                      Show More Products
                    </Link>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
