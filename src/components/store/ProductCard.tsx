import Link from "next/link";
import Image from "next/image";
import { ImageOff, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import PriceDisplay from "./PriceDisplay";
import StockBadge, { type StockState } from "./StockBadge";

export type ProductCardData = {
  id: string;
  title: string;
  basePrice: number;
  checkoutMode: string;
  brandName?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  badge?: StockState;
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

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-surface border border-border-base rounded-lg p-4 transition-shadow hover:shadow-md",
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
            whatever the photograph behind it looks like. */}
        {(product.badge || product.brandName) && (
          <div className="flex items-center gap-2 mb-1.5">
            {product.badge && <StockBadge state={product.badge} />}
            {product.brandName && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
                {product.brandName}
              </p>
            )}
          </div>
        )}
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2 group-hover:text-brand-orange-600 transition-colors">
          {product.title}
        </h3>
      </Link>

      <div className="mt-auto pt-1">
        {isInquire ? (
          <p className="text-lg font-bold text-slate-900">Pricing on Inquiry</p>
        ) : (
          <PriceDisplay price={product.basePrice} />
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
