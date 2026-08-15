import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { parseSpecs } from "@/lib/utils";
import { productCardInclude, toProductCardData } from "@/lib/catalog";
import { stockStateFor } from "@/components/store/StockBadge";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ProductGallery from "@/components/store/ProductGallery";
import ProductBuyBox from "@/components/store/ProductBuyBox";
import ProductInquiryBox from "@/components/store/ProductInquiryBox";
import ProductCard from "@/components/store/ProductCard";
import SpecTable from "@/components/store/SpecTable";
import SectionHeading from "@/components/store/SectionHeading";
import TrustStrip from "@/components/store/TrustStrip";
import WishlistButton from "@/components/store/WishlistButton";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: { title: true, description: true },
  });
  if (!product) return { title: "Product not found" };
  return { title: product.title, description: product.description.slice(0, 160) };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      brand: true,
      category: { include: { parent: true } },
      images: { include: { image: true }, orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { title: "asc" } },
    },
  });

  if (!product) notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [related, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id }, isAvailable: true },
      take: 4,
      include: productCardInclude,
    }),
    userId
      ? prisma.wishlistItem.findFirst({ where: { userId, productId: product.id } })
      : null,
  ]);

  const specs = parseSpecs(product.specs);
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const badge = stockStateFor(product.stockMode, product.isAvailable, totalStock);
  const isInquire = product.checkoutMode === "INQUIRE";

  return (
    <>
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-4 lg:pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...(product.category.parent
              ? [
                  {
                    label: product.category.parent.name,
                    href: `/categories/${product.category.parent.slug}`,
                  },
                ]
              : []),
            { label: product.category.name, href: `/categories/${product.category.slug}` },
            { label: product.title },
          ]}
        />
      </div>

      {/* ── Gallery + buy box ────────────────────────────────────────── */}
      <div className="max-w-content mx-auto px-4 lg:px-8 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 lg:items-start">
        <ProductGallery
          images={product.images.map((pi) => ({ url: pi.image.url, alt: pi.image.alt }))}
          title={product.title}
          badge={badge}
        />

        {/* Not sticky. Pinning this column made it lag behind the gallery as
            the page scrolled, so the two halves of the same section visibly
            came apart. Both columns now move as one block. */}
        <div className="mt-6 lg:mt-0">
          {product.brand && (
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange-600 mb-2">
              {product.brand.name}
            </p>
          )}
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight mb-3">
            {product.title}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">{product.description}</p>

          {isInquire ? (
            <ProductInquiryBox
              productId={product.id}
              productTitle={product.title}
              basePrice={product.basePrice}
            />
          ) : (
            <ProductBuyBox
              productId={product.id}
              basePrice={product.basePrice}
              stockMode={product.stockMode}
              isAvailable={product.isAvailable}
              variants={product.variants.map((v) => ({
                id: v.id,
                title: v.title,
                price: v.price,
                stock: v.stock,
                isAvailable: v.isAvailable,
              }))}
            />
          )}

          <div className="mt-4">
            <WishlistButton productId={product.id} initiallySaved={Boolean(wishlisted)} />
          </div>
        </div>
      </div>

      <div className="mt-12">
        <TrustStrip />
      </div>

      {/* ── Technical specifications ─────────────────────────────────── */}
      {Object.keys(specs).length > 0 && (
        <section className="max-w-content mx-auto px-4 lg:px-8 pt-12">
          <h2 className="text-xl lg:text-2xl font-semibold text-slate-900 border-l-4 border-brand-orange-600 pl-3 mb-6">
            Technical Specifications
          </h2>
          <div className="lg:max-w-3xl">
            <SpecTable specs={specs} />
          </div>
        </section>
      )}

      {/* ── Related products ─────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="pt-12">
          <div className="max-w-content mx-auto px-4 lg:px-8">
            <SectionHeading title="Recommended Accessories" hint="Swipe for more" />
          </div>
          <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto lg:overflow-visible no-scrollbar snap-x snap-mandatory px-4 lg:px-8 max-w-content mx-auto">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={toProductCardData(item)}
                className="min-w-[220px] lg:min-w-0 snap-start"
              />
            ))}
          </div>
        </section>
      )}

      {/* Clearance for the mobile sticky action bar */}
      <div className="h-20 lg:hidden" aria-hidden />
    </>
  );
}
