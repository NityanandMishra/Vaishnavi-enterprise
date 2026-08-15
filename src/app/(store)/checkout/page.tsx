import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/nextauth";
import { getCart, cartTotals, lineItemPrice } from "@/lib/cart";
import CheckoutForm from "@/components/store/CheckoutForm";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  const cart = await getCart();

  if (!cart || cart.items.length === 0) redirect("/cart");

  const lines = cart.items.map((item) => ({
    id: item.id,
    title: item.product.title,
    variantTitle: item.variant?.title ?? null,
    quantity: item.quantity,
    price: lineItemPrice(item.product.basePrice, item.variant?.price),
    imageUrl: item.product.images[0]?.image.url ?? null,
  }));

  const { subtotal, gst, total } = cartTotals(lines);

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Cart
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1.5 rounded-md">
          <ShieldCheck size={14} /> Secure
        </span>
      </div>

      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-6">Checkout</h1>

      <CheckoutForm
        lines={lines}
        subtotal={subtotal}
        gst={gst}
        total={total}
        defaultName={session?.user?.name ?? ""}
      />
    </div>
  );
}
