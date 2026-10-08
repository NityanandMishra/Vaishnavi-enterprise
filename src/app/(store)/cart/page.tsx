import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ShoppingCart, ShieldCheck, Truck, Banknote } from "lucide-react";
import { getCart, cartTotals, lineItemPrice } from "@/lib/cart";
import { formatINR } from "@/lib/utils";
import CartLineItem, { type CartLine } from "@/components/store/CartLineItem";
import EmptyState from "@/components/store/EmptyState";

export const metadata: Metadata = {
  title: "Your Shopping Cart — Vaishnavi Enterprises",
};

/**
 * Cart Page (§6.5)
 *
 * Line items left, sticky summary right at ≥1024px.
 * INQUIRE products are strictly excluded.
 */
export default async function CartPage() {
  const cart = await getCart();

  // INQUIRE products never enter the cart (§6.5)
  const lines: CartLine[] = (cart?.items ?? [])
    .filter((item) => item.product.checkoutMode !== "INQUIRE")
    .map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.product.slug ?? item.productId,
      title: item.product.title,
      brandName: item.product.brand?.name ?? null,
      variantTitle: item.variant?.title ?? null,
      quantity: item.quantity,
      price: lineItemPrice(item.product.basePrice, item.variant?.price),
      imageUrl: item.product.images[0]?.image.url ?? null,
    }));

  const { subtotal, gst, total } = cartTotals(lines);
  const isFreeDelivery = total >= 999;

  if (lines.length === 0) {
    return (
      <div className="wrap py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight mb-6">
          Your Shopping Cart
        </h1>
        <EmptyState
          icon={ShoppingCart}
          title="Your shopping cart is empty"
          description="Browse our catalogue of electrical goods, wires, and fans to add items."
          actionLabel="Browse Catalogue"
          actionHref="/categories"
        />
      </div>
    );
  }

  return (
    <div className="wrap py-6">
      {/* Return to store link */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--accent-ink)] transition-colors mb-3"
      >
        <ArrowLeft size={16} /> Return to Catalogue
      </Link>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight mb-6">
        Your Shopping Cart ({lines.length} {lines.length === 1 ? "Item" : "Items"})
      </h1>

      {/* Main Cart Grid: Items left, sticky summary right at ≥1024px */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
        {/* Line Items */}
        <div className="space-y-4">
          {lines.map((line) => (
            <CartLineItem key={line.id} line={line} />
          ))}
        </div>

        {/* Sticky Summary (§6.5) */}
        <aside className="mt-8 lg:mt-0 sticky top-24">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6 space-y-5">
            <h2 className="text-base font-bold text-[var(--fg)] border-b border-[var(--line-soft)] pb-3">
              Order Summary
            </h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Items Subtotal (Excl. Tax)</dt>
                <dd className="font-semibold text-[var(--fg)] fig">₹{formatINR(subtotal)}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">GST (18% Input Tax Credit)</dt>
                <dd className="font-semibold text-[var(--fg)] fig">₹{formatINR(gst)}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Delivery Fee</dt>
                <dd className="font-bold text-[var(--ok)]">
                  {isFreeDelivery ? "FREE" : "₹49"}
                </dd>
              </div>

              {!isFreeDelivery && (
                <div className="text-xs text-[var(--fg-quiet)] bg-[var(--mortar)] p-2 rounded">
                  Add items worth ₹{formatINR(999 - total)} more for <b>FREE Shipping</b>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-4 border-t border-[var(--line-soft)]">
                <dt className="text-base font-extrabold text-[var(--fg)]">To Pay</dt>
                <dd className="text-xl font-extrabold text-[var(--fg)] fig">
                  ₹{formatINR(total + (isFreeDelivery ? 0 : 49))}
                </dd>
              </div>
            </dl>

            <Link
              href="/checkout"
              className="act act-fill act-big act-wide shadow-xs mt-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </Link>

            {/* Secure / COD Reassurance line + GST note (§6.5) */}
            <div className="pt-4 border-t border-[var(--line-soft)] space-y-2 text-xs text-[var(--fg-muted)]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--ok)] flex-shrink-0" />
                <span>GST Tax Invoice issued in firm or individual name</span>
              </div>
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-[var(--ok)] flex-shrink-0" />
                <span>Cash on delivery accepted at doorstep</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[var(--ok)] flex-shrink-0" />
                <span>Direct dispatch from Suriyawan warehouse hub</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
