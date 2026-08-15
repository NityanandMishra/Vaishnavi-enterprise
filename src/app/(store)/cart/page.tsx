import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ShoppingCart, ShieldCheck, Truck } from "lucide-react";
import { getCart, cartTotals, lineItemPrice } from "@/lib/cart";
import { formatINR } from "@/lib/utils";
import CartLineItem, { type CartLine } from "@/components/store/CartLineItem";
import EmptyState from "@/components/store/EmptyState";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const cart = await getCart();

  const lines: CartLine[] = (cart?.items ?? []).map((item) => ({
    id: item.id,
    productId: item.productId,
    title: item.product.title,
    brandName: item.product.brand?.name ?? null,
    variantTitle: item.variant?.title ?? null,
    quantity: item.quantity,
    price: lineItemPrice(item.product.basePrice, item.variant?.price),
    imageUrl: item.product.images[0]?.image.url ?? null,
  }));

  const { subtotal, gst, total } = cartTotals(lines);

  if (lines.length === 0) {
    return (
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-6 pb-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-6">Your Shopping Cart</h1>
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse the catalogue and add products to get started."
          actionLabel="Start Shopping"
          actionHref="/categories"
        />
      </div>
    );
  }

  const summary = (
    <div className="bg-surface border border-border-base rounded-lg p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Subtotal (Excl. Tax)</dt>
          <dd className="font-medium text-slate-900">{formatINR(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Estimated GST (18%)</dt>
          <dd className="font-medium text-slate-900">{formatINR(gst)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Shipping</dt>
          <dd className="font-medium text-success">Free</dd>
        </div>
        <div className="flex justify-between pt-3 border-t border-border-base">
          <dt className="text-base font-bold text-slate-900">Total Amount</dt>
          <dd className="text-base font-bold text-slate-900">{formatINR(total)}</dd>
        </div>
      </dl>

      <Link
        href="/checkout"
        className="mt-5 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
      >
        Proceed to Checkout <ArrowRight size={17} />
      </Link>

      <ul className="mt-5 pt-5 border-t border-border-base space-y-2.5">
        <li className="flex items-center gap-2.5 text-xs text-slate-600">
          <ShieldCheck size={16} className="text-slate-900 flex-shrink-0" />
          GST invoice issued on every order
        </li>
        <li className="flex items-center gap-2.5 text-xs text-slate-600">
          <Truck size={16} className="text-slate-900 flex-shrink-0" />
          Free pan-India shipping
        </li>
      </ul>
    </div>
  );

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={16} /> Return to Store
      </Link>

      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mt-3 mb-6">
        Your Shopping Cart
      </h1>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
        <div className="space-y-4">
          {lines.map((line) => (
            <CartLineItem key={line.id} line={line} />
          ))}
        </div>

        {/* Desktop summary column */}
        <div className="hidden lg:block lg:sticky lg:top-24">{summary}</div>
      </div>

      {/* Mobile summary — inline, then a sticky total bar above the bottom nav */}
      <div className="lg:hidden mt-6">{summary}</div>

      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 bg-surface border-t border-border-base shadow-lg px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-900">Total Amount</span>
          <span className="text-base font-bold text-slate-900">{formatINR(total)}</span>
        </div>
        <Link
          href="/checkout"
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide"
        >
          Proceed to Checkout <ArrowRight size={17} />
        </Link>
      </div>

      <div className="h-32 lg:hidden" aria-hidden />
    </div>
  );
}
