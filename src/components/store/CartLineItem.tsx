"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2, ImageOff } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { updateCartItemQuantity, removeCartItem } from "@/app/(store)/actions";
import QuantityStepper from "./QuantityStepper";

export type CartLine = {
  id: string;
  productId: string;
  title: string;
  brandName: string | null;
  variantTitle: string | null;
  quantity: number;
  price: number;
  imageUrl: string | null;
};

export default function CartLineItem({ line }: { line: CartLine }) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [isPending, startTransition] = useTransition();

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
    <div className="bg-surface border border-border-base rounded-lg p-4 flex gap-4">
      <Link
        href={`/products/${line.productId}`}
        className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-surface-alt rounded-md overflow-hidden"
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.title} fill className="object-contain p-1.5" sizes="112px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={22} className="text-slate-300" />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.brandName && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {line.brandName}
              </p>
            )}
            <Link
              href={`/products/${line.productId}`}
              className="block text-sm sm:text-base font-bold text-slate-900 leading-snug hover:text-brand-orange-600 transition-colors"
            >
              {line.title}
            </Link>
            {line.variantTitle && (
              <p className="text-xs text-slate-600 mt-0.5">{line.variantTitle}</p>
            )}
          </div>

          <button
            onClick={remove}
            disabled={isPending}
            aria-label={`Remove ${line.title} from cart`}
            className="p-2 -mt-1 -mr-1 text-slate-400 hover:text-danger disabled:opacity-40 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mt-4">
          <QuantityStepper value={quantity} onChange={changeQuantity} disabled={isPending} />
          <div className="text-right">
            <p className="text-base sm:text-lg font-bold text-slate-900">
              {formatINR(line.price * quantity)}
            </p>
            <p className="text-[11px] text-muted">Excl. GST</p>
          </div>
        </div>
      </div>
    </div>
  );
}
