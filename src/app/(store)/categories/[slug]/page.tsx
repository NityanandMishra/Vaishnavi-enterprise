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
  wishlistedProductIds,
  PAGE_SIZE,
  type CatalogSearchParams,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/store/ProductCard";
import CatalogControls from "@/components/store/CatalogControls";
import ComingSoonTag from "@/components/store/ComingSoonTag";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import EmptyState from "@/components/store/EmptyState";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
  });
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} — Vaishnavi Enterprises`,
    description: category.description ?? `Browse ${category.name} at trade distributor prices.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: CatalogSearchParams & { sub?: string; avail?: string };
}) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      parent: true,
      children: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { products: true } } },
      },
    },
  });

  if (!category || category.deletedAt) notFound();

  // Scope: parent category includes subcategories if not filtered
  const childIds = category.children.map((c) => c.id);
  const scopeIds = searchParams.sub ? [searchParams.sub] : [category.id, ...childIds];

  const selectedBrands = brandFilter(searchParams.brand);
  const take = catalogTake(searchParams.show);

  // Availability filter (§6.2)
  let availCondition = {};
  if (searchParams.avail === "stock") {
    availCondition = {
      checkoutMode: "BUY",
      variants: { some: { stock: { gt: 0 } } },
    };
  } else if (searchParams.avail === "ask") {
    availCondition = {
      OR: [
        { checkoutMode: "INQUIRE" },
        { variants: { every: { stock: 0 } } },
      ],
    };
  }

  const where = {
    categoryId: { in: scopeIds },
    isAvailable: true,
    status: "ACTIVE",
    deletedAt: null,
    ...(selectedBrands.length > 0 && { brandId: { in: selectedBrands } }),
    ...availCondition,
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
      where: { categoryId: { in: scopeIds }, isAvailable: true, status: "ACTIVE", deletedAt: null },
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
    .filter((b) => b.count > 0);

  const wishlisted = await wishlistedProductIds(products.map((p) => p.id));
  const hasMore = totalCount > products.length;

  const nextShowParams = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string") as [string, string][]
  );
  nextShowParams.set("show", String(take + PAGE_SIZE));

  return (
    <div className="wrap py-6">
      {/* ── Breadcrumb Navigation ────────────────────────────────────────── */}
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(category.parent
            ? [{ label: category.parent.name, href: `/categories/${category.parent.slug}` }]
            : []),
          { label: category.name },
        ]}
      />

      {/* ── Category Header ─────────────────────────────────────────────── */}
      <div className="mt-4 mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight">
            {category.name}
          </h1>
          <span className="text-sm font-semibold text-[var(--fg-muted)]">
            {totalCount} {totalCount === 1 ? "Product" : "Products"}
          </span>
        </div>

        {category.description && (
          <p className="text-sm text-[var(--fg-muted)] max-w-2xl mt-1 leading-relaxed">
            {category.description}
          </p>
        )}

        {/* Sub-category chips row */}
        {category.children.length > 0 && (
          <div className="chips mt-4">
            <Link
              href={`/categories/${category.slug}`}
              className={cn("tag", !searchParams.sub && "active")}
              aria-pressed={!searchParams.sub}
            >
              All {category.name}
            </Link>
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/categories/${category.slug}?sub=${child.id}`}
                className={cn("tag", searchParams.sub === child.id && "active")}
                aria-pressed={searchParams.sub === child.id}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Layout: 264px Sidebar + Product Grid ───────────────────── */}
      <div className="lg:flex lg:gap-8 lg:items-start pt-2">
        <CatalogControls brands={brands} />

        <div className="flex-1 min-w-0 pt-4 lg:pt-0">
          {products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No matching products found"
              description="No trade items matched this combination of filters. Try clearing some filters or browse another category."
              actionLabel="View All Products"
              actionHref={`/categories/${category.slug}`}
            />
          ) : (
            <>
              {/* Fixed-slot Product Grid (§5.2) */}
              <div className="cat">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={toProductCardData(product, { wishlisted: wishlisted.has(product.id) })}
                  />
                ))}
              </div>

              {/* Pagination (§6.2: "Show N more" button) */}
              <div className="mt-8 text-center">
                <p className="text-xs text-[var(--fg-muted)] mb-3">
                  Showing {products.length} of {totalCount} items
                </p>
                {hasMore && (
                  <Link
                    href={`/categories/${category.slug}?${nextShowParams.toString()}`}
                    className="act act-line min-h-[48px] px-8"
                  >
                    Show More Products ({totalCount - products.length} remaining)
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
