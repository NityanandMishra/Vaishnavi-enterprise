import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  productCardInclude,
  toProductCardData,
  catalogOrderBy,
  catalogTake,
  brandFilter,
  HAS_PRODUCTS,
  PAGE_SIZE,
  type CatalogSearchParams,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/store/ProductCard";
import CatalogControls from "@/components/store/CatalogControls";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import EmptyState from "@/components/store/EmptyState";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description ?? `Browse ${category.name} at Vaishnavi Enterprises.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: CatalogSearchParams & { sub?: string };
}) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      parent: true,
      // Only subcategories that lead somewhere become filter chips. This also
      // narrows the product scope below, harmlessly — an excluded child has no
      // products to contribute.
      children: { where: { ...HAS_PRODUCTS }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!category) notFound();

  // A parent category shows its own products plus everything in its sub-categories.
  const childIds = category.children.map((c) => c.id);
  const scopeIds = searchParams.sub
    ? [searchParams.sub]
    : [category.id, ...childIds];

  const selectedBrands = brandFilter(searchParams.brand);
  const take = catalogTake(searchParams.show);

  const where = {
    categoryId: { in: scopeIds },
    ...(selectedBrands.length > 0 && { brandId: { in: selectedBrands } }),
  };

  const [products, totalCount, brandGroups] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: catalogOrderBy(searchParams.sort),
      take,
      include: productCardInclude,
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ["brandId"],
      where: { categoryId: { in: scopeIds } },
      _count: { _all: true },
    }),
  ]);

  const brandIds = brandGroups.map((g) => g.brandId).filter((id): id is string => Boolean(id));
  const brandRecords = brandIds.length
    ? await prisma.brand.findMany({ where: { id: { in: brandIds } }, orderBy: { name: "asc" } })
    : [];
  const brands = brandRecords
    .map((b) => ({
      id: b.id,
      name: b.name,
      count: brandGroups.find((g) => g.brandId === b.id)?._count._all ?? 0,
    }))
    // The groupBy already implies at least one product, but keep the rule
    // explicit so a brand can never render a "0" facet.
    .filter((b) => b.count > 0);

  const hasMore = totalCount > products.length;
  const nextShowParams = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string") as [string, string][]
  );
  nextShowParams.set("show", String(take + PAGE_SIZE));

  return (
    <>
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...(category.parent
              ? [{ label: category.parent.name, href: `/categories/${category.parent.slug}` }]
              : []),
            { label: category.name },
          ]}
        />

        <div className="flex flex-wrap items-baseline justify-between gap-2 mt-4 mb-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">{category.name}</h1>
          <span className="text-sm text-slate-600">{totalCount} Products</span>
        </div>
        {category.description && (
          <p className="text-sm text-slate-600 max-w-2xl mb-4">{category.description}</p>
        )}

        {/* Sub-category chips */}
        {category.children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-4 -mx-4 px-4 lg:mx-0 lg:px-0">
            <Link
              href={`/categories/${category.slug}`}
              className={cn(
                "flex-shrink-0 min-h-[40px] flex items-center px-4 rounded-full border text-sm font-medium transition-colors",
                !searchParams.sub
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-surface border-border-base text-slate-900 hover:border-slate-400"
              )}
            >
              All Items
            </Link>
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/categories/${category.slug}?sub=${child.id}`}
                className={cn(
                  "flex-shrink-0 min-h-[40px] flex items-center px-4 rounded-full border text-sm font-medium transition-colors",
                  searchParams.sub === child.id
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-surface border-border-base text-slate-900 hover:border-slate-400"
                )}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-content mx-auto lg:px-8 lg:flex lg:gap-8 lg:pt-2">
        <CatalogControls brands={brands} />

        <div className="flex-1 min-w-0 px-4 lg:px-0 pt-6">
          {products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products found"
              description="Nothing matches this selection yet. Try clearing filters or browsing another category."
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
                    href={`/categories/${category.slug}?${nextShowParams.toString()}`}
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
