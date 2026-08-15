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
  PAGE_SIZE,
  type CatalogSearchParams,
} from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import CatalogControls from "@/components/store/CatalogControls";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import EmptyState from "@/components/store/EmptyState";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Vaishnavi Enterprises catalogue.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: CatalogSearchParams;
}) {
  const query = (searchParams.q ?? "").trim();
  const selectedBrands = brandFilter(searchParams.brand);
  const take = catalogTake(searchParams.show);

  const where = {
    ...(query && {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
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
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  const brands = brandRecords.map((b) => ({
    id: b.id,
    name: b.name,
    count: b._count.products,
  }));

  const hasMore = totalCount > products.length;
  const nextShowParams = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string") as [string, string][]
  );
  nextShowParams.set("show", String(take + PAGE_SIZE));

  return (
    <>
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
        <div className="flex flex-wrap items-baseline justify-between gap-2 mt-4 mb-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            {query ? `Results for “${query}”` : "All Products"}
          </h1>
          <span className="text-sm text-slate-600">{totalCount} Products</span>
        </div>
      </div>

      <div className="max-w-content mx-auto lg:px-8 lg:flex lg:gap-8 lg:pt-2">
        <CatalogControls brands={brands} />

        <div className="flex-1 min-w-0 px-4 lg:px-0 pt-6">
          {products.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No products found"
              description={
                query
                  ? `We couldn't find anything matching “${query}”. Try a different term or browse by category.`
                  : "No products are available right now."
              }
              actionLabel="Browse All Categories"
              actionHref="/categories"
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={toProductCardData(product)} />
                ))}
              </div>

              <div className="mt-8 text-center">
                <p className="text-sm text-slate-600 mb-4">
                  Showing {products.length} of {totalCount} products
                </p>
                {hasMore && (
                  <Link
                    href={`/search?${nextShowParams.toString()}`}
                    className="inline-flex items-center justify-center min-h-[48px] w-full sm:w-auto px-10 rounded-md border border-border-base bg-surface text-sm font-bold uppercase tracking-wide text-slate-900 hover:border-slate-400 transition-colors"
                  >
                    Load More Products
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
