"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2, ImageOff, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { updateCartItemQuantity, removeCartItem } from "@/app/(store)/actions";
import QuantityStepper from "./QuantityStepper";

export type CartLine = {
  id: string;
  productId: string;
  slug?: string;
  title: string;
  brandName: string | null;
  variantTitle: string | null;
  quantity: number;
  price: number;
  imageUrl: string | null;
};

/**
 * Cart Line Item (§6.5)
 *
 * Each line: 88px thumbnail, brand, name, selected options, availability line,
 * quantity stepper (40px controls), remove link, line total right-aligned with .num.
 */
export default function CartLineItem({ line }: { line: CartLine }) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [isPending, startTransition] = useTransition();

  const productUrl = `/products/${line.slug || line.productId}`;

  function changeQuantity(next: number) {
    setQuantity(next);
    startTransition(async () => {
      await updateCartItemQuantity(line.id, next);
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItem(line.id);
    });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-4 flex gap-4 items-start">
      {/* 88px Thumbnail (§6.5) */}
      <Link
        href={productUrl}
        className="relative w-[88px] h-[88px] flex-shrink-0 bg-[var(--mortar)] rounded-md overflow-hidden"
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.title}
            fill
            className="object-contain p-2"
            sizes="88px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff size={20} />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.brandName && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] block">
                {line.brandName}
              </span>
            )}
            <Link
              href={productUrl}
              className="block text-sm sm:text-base font-bold text-[var(--fg)] hover:text-[var(--accent-ink)] transition-colors leading-snug line-clamp-2"
            >
              {line.title}
            </Link>
            {line.variantTitle && (
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                Specification: <strong className="text-[var(--fg)]">{line.variantTitle}</strong>
              </p>
            )}

            {/* Availability Line (§6.5) */}
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--ok)] font-medium">
              <CheckCircle2 size={13} />
              <span>In stock · Dispatches in 24–48 hours</span>
            </div>
          </div>

          <button
            onClick={remove}
            disabled={isPending}
            aria-label={`Remove ${line.title} from cart`}
            className="p-1.5 text-slate-400 hover:text-[var(--signal-700)] disabled:opacity-40 transition-colors rounded"
          >
            <Trash2 size={17} />
          </button>
        </div>

        {/* Stepper + Right-aligned Price with .num */}
        <div className="flex flex-wrap items-end justify-between gap-3 mt-4 pt-3 border-t border-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <QuantityStepper value={quantity} onChange={changeQuantity} disabled={isPending} />
            <span className="text-xs text-[var(--fg-quiet)]">
              @ ₹{formatINR(line.price)} / unit
            </span>
          </div>

          <div className="text-right">
            <span className="text-base sm:text-lg font-extrabold text-[var(--fg)] fig block">
              ₹{formatINR(line.price * quantity)}
            </span>
            <span className="text-[11px] text-[var(--fg-quiet)]">Excl. GST</span>
          </div>
        </div>
      </div>
    </div>
  );
}
