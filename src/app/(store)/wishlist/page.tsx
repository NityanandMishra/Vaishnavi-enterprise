import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { productCardInclude, toProductCardData } from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import EmptyState from "@/components/store/EmptyState";

export const metadata: Metadata = { title: "Your Wishlist" };

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login?callbackUrl=/wishlist");

  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: productCardInclude } },
  });

  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6 pb-4">
      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Your Wishlist</h1>
      <p className="text-sm text-slate-600 mt-1 mb-6">
        {items.length} {items.length === 1 ? "item" : "items"} saved for later
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Save products you're considering and come back to them any time."
          actionLabel="Browse Products"
          actionHref="/categories"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              product={toProductCardData(item.product)}
              action="move-to-cart"
            />
          ))}
        </div>
      )}
    </div>
  );
}
