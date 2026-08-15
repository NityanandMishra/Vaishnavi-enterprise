import { prisma } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageOff, Sun, Lightbulb, ClipboardList } from "lucide-react";
import { productCardInclude, toProductCardData } from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import HeroCarousel from "@/components/store/HeroCarousel";
import SectionHeading from "@/components/store/SectionHeading";
import TrustStrip from "@/components/store/TrustStrip";

/**
 * Solar section highlights, kept in step with /solar.
 *
 * The wireframe paired "Industrial Solar Setup" with "EV Fleet Solutions", but
 * the business does neither: commercial rooftop is a future offering and EV
 * charging infrastructure is not a service at all. What it does deliver is
 * residential rooftop and solar lighting, so the section advertises only those.
 */
const solarHighlights = [
  { icon: Sun, title: "Rooftop solar for homes", body: "Sized to your actual bill, surveyed before quoting." },
  { icon: Lightbulb, title: "Solar lighting", body: "Street, gate, and outdoor lights with no added meter load." },
  { icon: ClipboardList, title: "Free site assessment", body: "We measure and propose at no cost or obligation." },
];

export default async function HomePage() {
  const [topCategories, bestSellers] = await Promise.all([
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
  ]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <HeroCarousel />

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
      <section className="max-w-content mx-auto px-4 lg:px-8 pt-12 lg:pt-16">
        <div className="relative rounded-lg overflow-hidden bg-surface-inverse">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 80% 25%, rgba(234,88,12,0.55), transparent 55%), radial-gradient(circle at 10% 85%, rgba(73,124,255,0.35), transparent 50%)",
            }}
          />
          <div className="relative z-10 p-6 lg:p-10 lg:flex lg:items-center lg:gap-12">
            <div className="lg:flex-1">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-brand-orange-400 mb-2">
                Solar Solutions
              </span>
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3 max-w-lg">
                Lower your electricity bill, permanently
              </h2>
              <p className="text-sm lg:text-base text-slate-300 mb-6 max-w-lg">
                Rooftop solar for homes and housing societies, plus solar lighting for gates,
                lanes, and outdoor areas. We survey your site before we quote.
              </p>
              <Link
                href="/solar"
                className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
              >
                Book a free site assessment
                <ArrowRight size={16} />
              </Link>
            </div>

            <ul className="grid gap-3 mt-8 lg:mt-0 lg:w-[340px] flex-shrink-0">
              {solarHighlights.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3 bg-white/5 rounded-md p-3.5">
                  <Icon size={18} className="text-brand-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-sm font-semibold text-white">{title}</span>
                    <span className="block text-xs text-slate-400 leading-relaxed">{body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
