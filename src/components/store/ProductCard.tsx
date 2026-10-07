import Link from "next/link";
import Image from "next/image";
import { ImageOff, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import PriceDisplay from "./PriceDisplay";
import StockBadge, { type StockState } from "./StockBadge";
import RatingStars from "./RatingStars";
import WishlistHeartButton from "./WishlistHeartButton";

export type ProductCardData = {
  id: string;
  title: string;
  basePrice: number;
  mrp?: number | null;
  checkoutMode: string;
  brandName?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  badge?: StockState;
  rating?: number | null;
  reviewCount?: number;
  /** Set only when stock has dropped low enough to justify urgency copy. */
  lowStockCount?: number | null;
  wishlisted?: boolean;
};

type CardAction = "add-to-cart" | "move-to-cart" | "none";

export default function ProductCard({
  product,
  action = "add-to-cart",
  className,
}: {
  product: ProductCardData;
  action?: CardAction;
  className?: string;
}) {
  const isInquire = product.checkoutMode === "INQUIRE";
  const hasDiscount = typeof product.mrp === "number" && product.mrp > product.basePrice;
  const discountPct = hasDiscount
    ? Math.round(((product.mrp! - product.basePrice) / product.mrp!) * 100)
    : 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-surface border border-border-base rounded-lg p-4 transition-all hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
    >
      <Link href={`/products/${product.id}`} className="block">
        <div className="w-full aspect-square bg-surface-alt rounded-md overflow-hidden relative mb-3">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.title}
              fill
              className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff size={32} className="text-slate-300" />
            </div>
          )}
        </div>

        {/* Status sits below the image well, not over it, so it stays legible
            whatever the photograph behind it looks like — and on its own row,
            so the brand line starts at the same x on every card in a grid.
            The row keeps its height when a badge is missing to stop cards
            shifting relative to one another. */}
        <div className="flex items-center gap-2 min-h-[23px] mb-1.5">
          {product.badge && <StockBadge state={product.badge} />}
          {product.lowStockCount && (
            <span className="text-[11px] font-bold text-danger">
              Only {product.lowStockCount} left
            </span>
          )}
        </div>

        {product.brandName && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate mb-1">
            {product.brandName}
          </p>
        )}
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-brand-orange-600 transition-colors">
          {product.title}
        </h3>

        {!!product.reviewCount && product.rating != null && (
          <RatingStars rating={product.rating} reviewCount={product.reviewCount} className="mb-2" />
        )}
      </Link>

      {/* Overlays — siblings of the link, not descendants, so a tap on either
          never also triggers navigation to the product page. */}
      {hasDiscount && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center rounded-sm bg-danger px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          {discountPct}% OFF
        </span>
      )}
      <WishlistHeartButton
        productId={product.id}
        initiallySaved={product.wishlisted ?? false}
        className="absolute top-3 right-3 z-10"
      />

      <div className="mt-auto pt-1">
        {isInquire ? (
          <p className="text-lg font-bold text-slate-900">Pricing on Inquiry</p>
        ) : (
          <PriceDisplay price={product.basePrice} mrp={product.mrp} />
        )}

        {action !== "none" && (
          <Link
            href={`/products/${product.id}`}
            className={cn(
              "mt-3 w-full min-h-[44px] flex items-center justify-center gap-2 rounded-md text-sm font-bold uppercase tracking-wide transition-opacity hover:opacity-90",
              isInquire
                ? "bg-slate-900 text-white"
                : "bg-brand-orange-600 text-white"
            )}
          >
            {isInquire ? (
              "Request Quote"
            ) : (
              <>
                <ShoppingCart size={16} />
                {action === "move-to-cart" ? "Move to Cart" : "Buy Now"}
              </>
            )}
          </Link>
        )}
      </div>
    </div>
  );
}
