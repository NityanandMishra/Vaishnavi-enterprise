import type { Prisma } from "@prisma/client";
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
  variants: { select: { stock: true } },
} satisfies Prisma.ProductInclude;

type ProductWithCardData = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export function toProductCardData(product: ProductWithCardData): ProductCardData {
  const image = product.images[0]?.image;
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return {
    id: product.id,
    title: product.title,
    basePrice: product.basePrice,
    checkoutMode: product.checkoutMode,
    brandName: product.brand?.name ?? null,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    badge: stockStateFor(product.stockMode, product.isAvailable, totalStock),
  };
}

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
