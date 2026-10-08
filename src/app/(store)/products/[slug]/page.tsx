import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { ShieldCheck, Truck, Clock, Award, CheckCircle2, FileCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/nextauth";
import { parseSpecs } from "@/lib/utils";
import { productCardInclude, toProductCardData, wishlistedProductIds } from "@/lib/catalog";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ProductGallery from "@/components/store/ProductGallery";
import ProductBuyBox from "@/components/store/ProductBuyBox";
import ProductInquiryBox from "@/components/store/ProductInquiryBox";
import ProductCard from "@/components/store/ProductCard";
import SpecTable from "@/components/store/SpecTable";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product =
    (await prisma.product.findUnique({ where: { slug: params.slug } })) ||
    (await prisma.product.findUnique({ where: { id: params.slug } }));

  if (!product) return { title: "Product not found" };

  return {
    title: `${product.title} — Vaishnavi Enterprises`,
    description:
      product.shortDescription ||
      product.description.slice(0, 160) ||
      `Buy ${product.title} at Vaishnavi Enterprises.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  // Dual lookup: resolve by slug first (clean URL), fallback to UUID for legacy links
  let product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      brand: true,
      category: { include: { parent: true } },
      images: { include: { image: true }, orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      variants: {
        where: { isAvailable: true },
        orderBy: { title: "asc" },
        include: {
          attributeValues: {
            include: {
              attribute: true,
              attributeValue: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    product = await prisma.product.findUnique({
      where: { id: params.slug },
      include: {
        brand: true,
        category: { include: { parent: true } },
        images: { include: { image: true }, orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
        variants: {
          where: { isAvailable: true },
          orderBy: { title: "asc" },
          include: {
            attributeValues: {
              include: {
                attribute: true,
                attributeValue: true,
              },
            },
          },
        },
      },
    });
  }

  if (!product || product.deletedAt) notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [relatedProducts, userWishlist] = await Promise.all([
    prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isAvailable: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      take: 4,
      include: productCardInclude,
    }),
    userId
      ? prisma.wishlistItem.findFirst({
          where: { userId, productId: product.id },
        })
      : null,
  ]);

  const relatedWishlisted = await wishlistedProductIds(relatedProducts.map((p) => p.id));
  const specs = parseSpecs(product.specs);
  const isInquire = product.checkoutMode === "INQUIRE";

  return (
    <div className="wrap py-6">
      {/* ── Breadcrumb Navigation ────────────────────────────────────────── */}
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

      {/* ── Main Two-Column Layout (§6.3: ≥900px two columns) ────────────── */}
      <div className="pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 lg:items-start">
        {/* Left Column: Gallery & Details */}
        <div className="min-w-0 space-y-8">
          {/* Gallery (1:1, max 460px with thumbnails) */}
          <div className="max-w-[460px] mx-auto lg:mx-0">
            <ProductGallery
              images={product.images.map((img) => ({
                url: img.image.url,
                alt: img.altText || img.image.alt || product.title,
              }))}
              title={product.title}
            />
          </div>

          {/* Product Header Information */}
          <div>
            {product.brand && (
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-ink)] block mb-1">
                {product.brand.name}
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight mb-2">
              {product.title}
            </h1>

            {/* Plain-Language Decisive Fact (Principle P-01) */}
            <p className="text-base text-[var(--fg-muted)] leading-relaxed font-medium">
              {product.shortDescription || "Original equipment sourced directly from authorised Indian distribution hubs."}
            </p>
          </div>

          {/* Detailed Product Narrative */}
          <div className="prose max-w-none text-sm text-[var(--fg)] leading-relaxed border-t border-[var(--line-soft)] pt-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--fg-muted)] mb-2">
              Product Overview
            </h3>
            <p>{product.description}</p>
          </div>

          {/* Why This Product (§6.3: 3 plain-language points) */}
          <div className="p-5 rounded bg-[var(--surface)] border border-[var(--line)] space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--fg-quiet)]">
              Trade Assurance on this item
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[var(--fg)]">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-[var(--copper-600)] flex-shrink-0 mt-0.5" />
                <div>
                  <b>Authorised Warranty</b>
                  <p className="text-[var(--fg-muted)] mt-0.5">Original manufacturer warranty card included in parcel.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FileCheck size={18} className="text-[var(--copper-600)] flex-shrink-0 mt-0.5" />
                <div>
                  <b>GST Tax Invoice</b>
                  <p className="text-[var(--fg-muted)] mt-0.5">Eligible for business input tax credit (ITC) across India.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Truck size={18} className="text-[var(--copper-600)] flex-shrink-0 mt-0.5" />
                <div>
                  <b>Damage-Free Dispatch</b>
                  <p className="text-[var(--fg-muted)] mt-0.5">Tested & reinforced prior to courier handover.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details Table */}
          {Object.keys(specs).length > 0 && (
            <div className="space-y-3 border-t border-[var(--line-soft)] pt-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--fg-muted)]">
                Technical Specifications
              </h3>
              <SpecTable specs={specs} />
            </div>
          )}
        </div>

        {/* Right Column: Buy Box or Inquiry Box */}
        <div className="mt-8 lg:mt-0 sticky top-24">
          {isInquire ? (
            <ProductInquiryBox
              productId={product.id}
              productTitle={product.title}
              sku={product.variants[0]?.sku || ""}
              sourcingLeadDays={product.sourcingLeadDays ?? 7}
            />
          ) : (
            <ProductBuyBox
              productId={product.id}
              productTitle={product.title}
              basePrice={product.basePrice}
              variants={product.variants.map((v) => ({
                id: v.id,
                title: v.title,
                sku: v.sku || "",
                price: v.price,
                mrp: v.mrp,
                stock: v.stock,
                isAvailable: v.isAvailable,
                variantAttributeValues: v.attributeValues,
              }))}
              stockMode={product.stockMode}
              isAvailable={product.isAvailable}
              sourcingLeadDays={product.sourcingLeadDays ?? 5}
            />
          )}
        </div>
      </div>

      {/* ── Related Category Products (§6.3) ────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[var(--line)]">
          <div className="lede mb-6">
            <h2>Related in {product.category.name}</h2>
            <a href={`/categories/${product.category.slug}`}>
              View all in {product.category.name} →
            </a>
          </div>

          <div className="cat">
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={toProductCardData(p, { wishlisted: relatedWishlisted.has(p.id) })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
