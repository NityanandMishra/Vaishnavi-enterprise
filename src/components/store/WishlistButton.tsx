"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlistItem } from "@/app/(store)/actions";

export default function WishlistButton({
  productId,
  initiallySaved,
}: {
  productId: string;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();

  function toggle() {
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
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      className={cn(
        "w-full min-h-[44px] flex items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors disabled:opacity-50",
        saved
          ? "border-danger text-danger bg-danger/5"
          : "border-border-base text-slate-700 hover:border-slate-400"
      )}
    >
      <Heart size={16} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved to Wishlist" : "Save to Wishlist"}
    </button>
  );
}
