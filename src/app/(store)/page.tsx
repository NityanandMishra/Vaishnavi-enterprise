import { prisma } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageOff } from "lucide-react";
import { productCardInclude, toProductCardData } from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import SectionHeading from "@/components/store/SectionHeading";
import TrustStrip from "@/components/store/TrustStrip";

export default async function HomePage() {
  const [topCategories, bestSellers, inquiryCategories] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { image: true },
      take: 8,
    }),
    prisma.product.findMany({
      where: { isAvailable: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: productCardInclude,
    }),
    prisma.category.findMany({
      where: { parentId: null, defaultCheckoutMode: "INQUIRE" },
      orderBy: { sortOrder: "asc" },
      include: { image: true },
      take: 2,
    }),
  ]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative bg-surface-inverse overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 75% 30%, rgba(234,88,12,0.55), transparent 55%), radial-gradient(circle at 15% 80%, rgba(73,124,255,0.35), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative max-w-content mx-auto px-4 lg:px-8 py-16 lg:py-28">
          <div className="max-w-2xl">
            <span className="inline-block bg-brand-orange-600 text-white text-[11px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-sm mb-4">
              Premium Energy Solutions
            </span>
            <h1 className="text-3xl lg:text-5xl font-bold text-white leading-tight mb-4">
              Engineered for Maximum Efficiency
            </h1>
            <p className="text-base lg:text-lg text-slate-300 mb-8 max-w-lg leading-relaxed">
              Tier-1 solar panels, EV infrastructure, LED lighting and electrical
              components for industrial and residential projects. Delivered pan-India.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/categories"
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-8 rounded-md bg-brand-orange-600 text-white font-bold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity"
              >
                Explore Products <ArrowRight size={18} />
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center min-h-[48px] px-8 rounded-md bg-white/10 border border-white/20 text-white font-bold text-sm uppercase tracking-wide hover:bg-white/20 transition-colors"
              >
                Get a Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Grid ────────────────────────────────────────────── */}
      {topCategories.length > 0 && (
        <section className="max-w-content mx-auto px-4 lg:px-8 pt-12 lg:pt-16">
          <SectionHeading title="Product Categories" actionLabel="View All" actionHref="/categories" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group bg-surface border border-border-base rounded-lg p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <div className="w-full aspect-square bg-surface-alt rounded-md overflow-hidden relative">
                  {cat.image ? (
                    <Image
                      src={cat.image.url}
                      alt={cat.image.alt ?? cat.name}
                      fill
                      className="object-contain p-3"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={28} className="text-slate-300" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-center text-slate-900 group-hover:text-brand-orange-600 transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Best Sellers ─────────────────────────────────────────────── */}
      {bestSellers.length > 0 && (
        <section className="pt-12 lg:pt-16">
          <div className="max-w-content mx-auto px-4 lg:px-8">
            <SectionHeading
              title="Best Sellers"
              hint="Swipe for more"
              actionLabel="View All"
              actionHref="/search"
            />
          </div>
          {/* Horizontal carousel on mobile, grid from lg */}
          <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto lg:overflow-visible no-scrollbar snap-x snap-mandatory px-4 lg:px-8 max-w-content mx-auto">
            {bestSellers.slice(0, 8).map((product) => (
              <ProductCard
                key={product.id}
                product={toProductCardData(product)}
                className="min-w-[220px] lg:min-w-0 snap-start"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Trust Strip ──────────────────────────────────────────────── */}
      <div className="mt-12 lg:mt-16">
        <TrustStrip />
      </div>

      {/* ── Consultancy & Setup ──────────────────────────────────────── */}
      {inquiryCategories.length > 0 && (
        <section className="max-w-content mx-auto px-4 lg:px-8 pt-12 lg:pt-16">
          <SectionHeading title="Consultancy & Setup" />
          <div className="grid gap-4 md:grid-cols-2">
            {inquiryCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group relative rounded-lg overflow-hidden bg-surface-inverse min-h-[180px] flex items-center p-6 lg:p-8"
              >
                {cat.image && (
                  <Image
                    src={cat.image.url}
                    alt=""
                    fill
                    className="object-cover opacity-30 group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                )}
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-white mb-1">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-sm text-slate-300 mb-4 max-w-sm">{cat.description}</p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                    Inquire Now <ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── About ────────────────────────────────────────────────────── */}
      <section className="max-w-content mx-auto px-4 lg:px-8 pt-12 lg:pt-16 pb-4">
        <div className="bg-surface border border-border-base rounded-lg p-6 lg:p-8 lg:flex lg:items-center lg:gap-12">
          <div className="lg:flex-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange-600 mb-2">
              About Vaishnavi Enterprises
            </h2>
            <p className="text-base text-slate-700 leading-relaxed mb-6 lg:mb-0 max-w-2xl">
              A trusted industrial supply partner based in Suriyawan, Bhadohi, providing
              high-stakes energy and electrical infrastructure across India. We focus on
              genuine products, technical clarity, and dependable after-sales support.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border-base lg:pl-12">
            <div>
              <p className="text-2xl font-bold text-slate-900">15k+</p>
              <p className="text-xs text-slate-600 mt-0.5">Orders Delivered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">500+</p>
              <p className="text-xs text-slate-600 mt-0.5">Products Range</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
