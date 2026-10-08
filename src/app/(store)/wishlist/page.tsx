import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { productCardInclude, toProductCardData } from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "Your Saved Hardware | Vaishnavi Enterprises",
  description: "Saved trade products and electrical hardware for future reference.",
};

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login?callbackUrl=/wishlist");

  const items = await prisma.wishlistItem.findMany({
    where: {
      userId,
      product: { deletedAt: null, isAvailable: true },
    },
    orderBy: { createdAt: "desc" },
    include: { product: { include: productCardInclude } },
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="wrap pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Saved Items" }]} />

        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-4 mb-6 border-b border-[var(--line)] pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight">
              Saved Products & Equipment
            </h1>
            <p className="text-xs sm:text-sm text-[var(--fg-muted)] mt-1">
              Keep track of required hardware for ongoing commercial installations.
            </p>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[var(--fg-muted)] fig">
            {items.length} {items.length === 1 ? "product" : "products"} saved
          </span>
        </div>

        {items.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-12 text-center max-w-lg mx-auto my-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--mortar)] flex items-center justify-center mx-auto text-[var(--fg-quiet)]">
              <Heart size={24} />
            </div>
            <h2 className="text-lg font-bold text-[var(--fg)]">Your saved list is empty</h2>
            <p className="text-sm text-[var(--fg-muted)]">
              Tap the bookmark icon on any electrical product card to save it here for later reference.
            </p>
            <div className="pt-2">
              <a href="/" className="act act-fill">
                Browse Trade Catalogue
              </a>
            </div>
          </div>
        ) : (
          <div className="cat">
            {items.map((item) => (
              <ProductCard
                key={item.id}
                product={toProductCardData(item.product, { wishlisted: true })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
