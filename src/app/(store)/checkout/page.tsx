import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/nextauth";
import { getCart, cartTotals, lineItemPrice } from "@/lib/cart";
import CheckoutForm from "@/components/store/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout — Direct Commercial Dispatch | Vaishnavi Enterprises",
  description: "Secure trade checkout for electrical equipment, solar hardware, and industrial supplies.",
};

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  const cart = await getCart();

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  // Filter out any inquiry items (defense in depth)
  const buyItems = cart.items.filter((item) => item.product.checkoutMode !== "INQUIRE");
  if (buyItems.length === 0) {
    redirect("/cart");
  }

  const lines = buyItems.map((item) => ({
    id: item.id,
    title: item.product.title,
    variantTitle: item.variant?.title ?? null,
    quantity: item.quantity,
    price: lineItemPrice(item.product.basePrice, item.variant?.price),
    imageUrl: item.product.images[0]?.image.url ?? null,
  }));

  const { subtotal, gst, total } = cartTotals(lines);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      {/* ── Checkout Header & Step Indicator (§6.6) ────────────────────────── */}
      <div className="bg-[var(--surface)] border-b border-[var(--line)] py-4">
        <div className="wrap">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--accent-ink)] transition-colors"
            >
              <ArrowLeft size={16} /> Return to Cart
            </Link>

            {/* 3-Step Indicator */}
            <nav aria-label="Checkout Progress" className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold">
              <Link
                href="/cart"
                className="flex items-center gap-1.5 text-[var(--ok)] hover:underline"
              >
                <span className="w-5 h-5 rounded-full bg-[var(--ok-wash)] text-[var(--ok)] flex items-center justify-center text-xs font-bold">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>Cart</span>
              </Link>
              <span className="text-[var(--line)]">/</span>

              <div className="flex items-center gap-1.5 text-[var(--fg)]">
                <span className="w-5 h-5 rounded-full bg-[var(--ink-900)] text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span className="font-bold">Address</span>
              </div>
              <span className="text-[var(--line)]">/</span>

              <div className="flex items-center gap-1.5 text-[var(--fg-quiet)]">
                <span className="w-5 h-5 rounded-full bg-[var(--mortar-deep)] text-[var(--fg-quiet)] flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>Payment</span>
              </div>
            </nav>

            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-[var(--ok)]">
              <ShieldCheck size={16} /> 256-Bit Encrypted Trade Checkout
            </div>
          </div>
        </div>
      </div>

      <div className="wrap pt-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight">
            Order Checkout
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            Direct commercial dispatch from our Main Logistics Hub in Bhadohi.
          </p>
        </div>

        <CheckoutForm
          lines={lines}
          subtotal={subtotal}
          gst={gst}
          total={total}
          defaultName={session?.user?.name ?? ""}
        />
      </div>
    </div>
  );
}
