"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlistItem } from "@/app/(store)/actions";

/**
 * Icon-only wishlist toggle for product grids.
 *
 * Rendered as a sibling of the card's image `Link`, not a descendant of it —
 * nesting a button inside the link would fire navigation on every click
 * alongside the toggle. Positioning is the caller's job (it's placed with
 * `absolute` over the image well from ProductCard).
 */
export default function WishlistHeartButton({
  productId,
  initiallySaved,
  className,
}: {
  productId: string;
  initiallySaved: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleWishlistItem(productId);
      if (!result.ok) {
        router.push(`/auth/login?callbackUrl=/products/${productId}`);
        return;
      }
      setSaved(result.saved);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-sm shadow-sm border border-black/5 transition-colors disabled:opacity-50",
        saved ? "text-danger" : "text-slate-500 hover:text-danger",
        className
      )}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
