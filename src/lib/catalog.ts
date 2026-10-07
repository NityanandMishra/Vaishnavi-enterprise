import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import type { ProductCardData } from "@/components/store/ProductCard";
import { stockStateFor } from "@/components/store/StockBadge";

/** Include clause every product listing uses — main image first, plus brand. */
export const productCardInclude = {
  images: {
    include: { image: true },
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
    take: 1,
  },
  brand: true,
  variants: { select: { price: true, mrp: true, stock: true, isDefault: true } },
  reviews: { where: { status: "APPROVED", deletedAt: null }, select: { rating: true } },
} satisfies Prisma.ProductInclude;

type ProductWithCardData = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export function toProductCardData(
  product: ProductWithCardData,
  opts?: { wishlisted?: boolean }
): ProductCardData {
  const image = product.images[0]?.image;
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const priceVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const reviewCount = product.reviews.length;
  const avgRating =
    reviewCount > 0 ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : null;

  return {
    id: product.id,
    title: product.title,
    basePrice: priceVariant?.price ?? product.basePrice,
    mrp: priceVariant?.mrp ?? null,
    checkoutMode: product.checkoutMode,
    brandName: product.brand?.name ?? null,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    badge: stockStateFor(product.stockMode, product.isAvailable, totalStock),
    rating: avgRating,
    reviewCount,
    lowStockCount: totalStock > 0 && totalStock <= 5 ? totalStock : null,
    wishlisted: opts?.wishlisted ?? false,
  };
}

/**
 * Which of these products the signed-in shopper has already saved.
 *
 * One query per listing page rather than one per card — a grid of 12-24
 * products would otherwise mean that many round trips just to draw a heart
 * icon. Guests and signed-out sessions get an empty set without touching the
 * database at all.
 */
export async function wishlistedProductIds(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return new Set();

  const items = await prisma.wishlistItem.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(items.map((i) => i.productId));
}

/**
 * Storefront visibility rule for taxonomy.
 *
 * Subcategories and brands are only worth showing a shopper if they lead
 * somewhere — an empty filter chip or brand checkbox just yields "no results".
 * Apply as a relation filter: `where: { ...HAS_PRODUCTS }`.
 *
 * Admin screens deliberately do not use this; an empty category still has to be
 * manageable before anything is filed under it.
 */
export const HAS_PRODUCTS = { products: { some: {} } } as const;

export const PAGE_SIZE = 12;

export type CatalogSearchParams = {
  sort?: string;
  brand?: string;
  show?: string;
  q?: string;
};

export function catalogOrderBy(sort?: string): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { basePrice: "asc" };
    case "price-desc":
      return { basePrice: "desc" };
    case "name":
      return { title: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

/** How many products to render — grows as the visitor taps "Load more". */
export function catalogTake(show?: string): number {
  const parsed = Number(show);
  if (!Number.isFinite(parsed) || parsed < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(parsed, 96);
}

export function brandFilter(brand?: string): string[] {
  return (brand ?? "").split(",").filter(Boolean);
}
