"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageOff, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import type { StockState } from "./StockBadge";
import WishlistHeartButton from "./WishlistHeartButton";

export type ProductCardData = {
  id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  basePrice: number;
  mrp?: number | null;
  checkoutMode: string;
  brandName?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  totalStock?: number;
  isAvailable?: boolean;
  sourcingLeadDays?: number | null;
  badge?: StockState;
  rating?: number | null;
  reviewCount?: number;
  lowStockCount?: number | null;
  wishlisted?: boolean;
};

type CardAction = "add-to-cart" | "view" | "none";

/**
 * Product Card Component (§5.2 Slot System)
 *
 * Implements strict fixed-height template with named, reserved slots.
 * Cards never resize to dynamic text content so grid CTAs align horizontally.
 *
 * Slots:
 * 1. Media: --cell-img (168px mobile / 196px desktop)
 * 2. Brand: 17px
 * 3. Title: 40px (2 lines max, overflow hidden)
 * 4. Plain Description Fact: 34px (2 lines max, e.g. "Fits a normal 10x12 bedroom")
 * 5. Price: 28px (₹now + ₹was OR "Price on request")
 * 6. Savings/Sub-line: 18px ("Save ₹XXX" or "Rate confirmed today")
 * 7. Availability: 18px ("In stock · 2 days", "Last 2 left", "Arranged in 5–7 days")
 * 8. CTA: 44px (margin-top: auto, pinned to bottom)
 */
export default function ProductCard({
  product,
  action = "view",
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

  const productUrl = `/products/${product.slug || product.id}`;
  const totalStock = product.totalStock ?? 0;
  const leadDays = product.sourcingLeadDays || 5;

  return (
    <article
      className={cn(
        "cell pcard",
        isInquire && "on-ask is-ask",
        className
      )}
    >
      {/* ── Slot 1: Media (--cell-img) ─────────────────────────────────── */}
      <div className="cell-fig pcard-media">
        <Link href={productUrl} className="w-full h-full block relative" tabIndex={-1}>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.title}
              fill
              className="object-contain p-3 transition-transform duration-300 hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ImageOff size={32} />
            </div>
          )}
        </Link>

        {/* Top-left Badges */}
        {isInquire ? (
          <span className="flag flag-ask" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
            ORDER TO SIZE
          </span>
        ) : hasDiscount ? (
          <span className="flag flag-ok" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
            {discountPct}% OFF
          </span>
        ) : null}

        {/* Top-right Wishlist Heart */}
        <WishlistHeartButton
          productId={product.id}
          initiallySaved={product.wishlisted ?? false}
          className="absolute top-2 right-2 z-10"
        />
      </div>

      {/* ── Body Container ──────────────────────────────────────────────── */}
      <div className="cell-body">
        {/* Slot 2: Brand Maker (17px) */}
        <div className="cell-maker pcard-brand">
          {product.brandName || "VAISHNAVI"}
        </div>

        {/* Slot 3: Title (40px) */}
        <h3 className="cell-name pcard-title">
          <Link href={productUrl} className="hover:text-[var(--accent-ink)] transition-colors">
            {product.title}
          </Link>
        </h3>

        {/* Slot 4: Plain-language Decisive Fact (34px, Principle P-01) */}
        <p className="cell-note pcard-desc">
          {product.shortDescription || "Quality verified electrical equipment with manufacturer warranty."}
        </p>

        {/* Slot 5: Price (28px) */}
        <div className="cell-price pcard-price">
          {isInquire ? (
            <span className="ask">Price on request</span>
          ) : (
            <>
              <span className="now fig">₹{formatINR(product.basePrice)}</span>
              {hasDiscount && <span className="was fig">₹{formatINR(product.mrp!)}</span>}
            </>
          )}
        </div>

        {/* Slot 6: Savings / Confirmation Sub-line (18px) */}
        <div className={cn("cell-sub pcard-save", isInquire && "on-ask")}>
          {isInquire ? (
            "Rate confirmed today"
          ) : hasDiscount ? (
            `Save ₹${formatINR(product.mrp! - product.basePrice)}`
          ) : (
            <span style={{ color: "var(--fg-quiet)", fontWeight: 500 }}>Price includes GST</span>
          )}
        </div>

        {/* Slot 7: Honest Availability (18px, Principle P-05) */}
        <div className="cell-stock pcard-avail">
          {isInquire ? (
            <span style={{ color: "var(--ask)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} />
              Arranged in {leadDays}–{leadDays + 2} days
            </span>
          ) : product.lowStockCount ? (
            <span style={{ color: "var(--signal-700)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={13} />
              Last {product.lowStockCount} left
            </span>
          ) : product.isAvailable === false || totalStock === 0 ? (
            <span style={{ color: "var(--ask)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} />
              Arranged in {leadDays}–{leadDays + 2} days
            </span>
          ) : (
            <span style={{ color: "var(--ok)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} />
              In stock · 2 days
            </span>
          )}
        </div>

        {/* Slot 8: CTA Button (44px, pinned to bottom) */}
        {action !== "none" && (
          <div className="cell-act pcard-cta">
            {isInquire ? (
              <Link href={productUrl} className="act act-brass act-wide">
                Ask the price
              </Link>
            ) : (
              <Link href={productUrl} className="act act-fill act-wide">
                View details
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
