import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Wind,
  Layers,
  Lightbulb,
  Flame,
  BatteryCharging,
  Bike,
  BatteryMedium,
  Wrench,
  Sun,
  ClipboardCheck,
  Building2,
  MessageCircle,
} from "lucide-react";
import { productCardInclude, toProductCardData, wishlistedProductIds } from "@/lib/catalog";
import ProductCard from "@/components/store/ProductCard";
import TrustStrip from "@/components/store/TrustStrip";
import { ownerWhatsAppUrl } from "@/lib/utils";

// Category icon map for the 9 confirmed trade departments
const categoryIcons: Record<string, any> = {
  "fans": Wind,
  "electrical-wires": Layers,
  "electrical-fittings": Zap,
  "led-lighting": Lightbulb,
  "home-appliances": Flame,
  "ups-systems": BatteryCharging,
  "electric-vehicles": Bike,
  "ev-batteries-chargers": BatteryMedium,
  "ev-accessories": Wrench,
};

export default async function HomePage() {
  const [categories, popularProducts] = await Promise.all([
    prisma.category.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        slug: { notIn: ["inv-test-cat", "inventory-test-category", "apparel-shipping-test"] },
      },
      orderBy: { sortOrder: "asc" },
      take: 9,
    }),
    prisma.product.findMany({
      where: {
        isAvailable: true,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: productCardInclude,
    }),
  ]);

  const wishlisted = await wishlistedProductIds(popularProducts.map((p) => p.id));

  return (
    <>
      {/* ── 1. HERO SECTION (§6.1) ────────────────────────────────────── */}
      <section className="relative bg-[var(--ink-900)] text-white overflow-hidden py-14 lg:py-24 border-b border-[var(--steel-600)]">
        {/* Subtle decorative copper radial gradient */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, rgba(201, 106, 60, 0.4) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(31, 107, 82, 0.25) 0%, transparent 40%)",
          }}
          aria-hidden="true"
        />

        <div className="wrap relative z-10">
          <div className="max-w-3xl">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold uppercase tracking-wider text-[var(--copper-lit)] mb-4">
              <span className="w-2 h-2 rounded-full bg-[var(--copper-lit)] animate-pulse" />
              Suriyawan, Bhadohi · Pan-India Dispatch
            </div>

            {/* H1 Heading (32px mobile / 46px desktop) */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-5 leading-[1.12]">
              Direct Sourcing for Electrical Goods, Fans & Solar.
            </h1>

            {/* Honest Lead Fact (No fabricated numbers) */}
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl">
              Authentic manufacturer prices from Crompton, Havells, Polycab, Microtek and ZOE Motors.
              Standard orders dispatched in 48 hours with sequential GST invoice; custom and heavy
              equipment arranged to order.
            </p>

            {/* Two Action CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <a href="#popular" className="act act-fill act-big">
                Browse products
                <ArrowRight size={18} />
              </a>

              <a
                href="#how-inquire-works"
                className="act act-big border-white/30 text-white hover:bg-white/10"
                style={{ border: "1.5px solid rgba(255,255,255,0.3)" }}
              >
                Why some products have no price
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST / ASSURANCE STRIP (§6.1) ─────────────────────────── */}
      <TrustStrip />

      {/* ── 3. SHOP BY CATEGORY (§6.1) ────────────────────────────────── */}
      <section className="band band-paper">
        <div className="wrap">
          <div className="lede">
            <h2>Shop by Department</h2>
            <Link href="/categories">
              All 9 Categories →
            </Link>
          </div>

          <div className="depts">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.slug] || Zap;
              return (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="dept group"
                >
                  <div className="dept-fig text-[var(--accent-ink)] group-hover:scale-110 transition-transform">
                    <Icon size={34} strokeWidth={1.8} />
                  </div>
                  <span>{cat.name}</span>
                </Link>
              );
            })}

            {/* 10th Tile: All Categories */}
            <Link href="/categories" className="dept group bg-[var(--mortar)]">
              <div className="dept-fig text-[var(--fg-muted)] group-hover:scale-110 transition-transform">
                <ArrowRight size={34} strokeWidth={1.8} />
              </div>
              <span className="text-[var(--accent-ink)]">Browse All Items →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. POPULAR RIGHT NOW (§6.1) ───────────────────────────────── */}
      <section id="popular" className="band">
        <div className="wrap">
          <div className="lede">
            <h2>Popular Right Now</h2>
            <Link href="/categories">
              View Entire Catalogue →
            </Link>
          </div>

          <div className="cat">
            {popularProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={toProductCardData(product, { wishlisted: wishlisted.has(product.id) })}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. LOAD-BEARING EXPLAINER: CAN'T SEE A PRICE? (§6.1) ──────── */}
      <section id="how-inquire-works" className="band band-brass border-y border-[var(--brass-line)]">
        <div className="wrap">
          <div className="max-w-3xl mb-8">
            <span className="flag flag-ask mb-3">OPERATING PRINCIPLE</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fg)] mt-2 mb-3">
              Can’t see a price on some items? That’s on purpose.
            </h2>
            <p className="text-base text-[var(--fg-muted)] leading-relaxed">
              Industrial Lithium batteries, commercial electric loaders, and heavy custom cables carry
              variable pricing linked to raw copper and metal indexes. Rather than displaying outdated
              estimates, we verify real-time factory rates on demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded bg-white border border-[var(--brass-line)] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="font-bold text-base text-[var(--fg)]">You tell us your requirement</h3>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                Specify your desired gauge, payload, or battery specification through WhatsApp or our simple form.
              </p>
            </div>

            <div className="p-6 rounded bg-white border border-[var(--brass-line)] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="font-bold text-base text-[var(--fg)]">We reply the same day</h3>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                Our Suriyawan trade counter confirms factory availability, lead time, and exact GST rate within hours.
              </p>
            </div>

            <div className="p-6 rounded bg-white border border-[var(--brass-line)] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--ask)] text-white font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="font-bold text-base text-[var(--fg)]">Pay only after you agree</h3>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                No advance obligations. Dispatched directly in 5–7 days with tracking and full tax invoice.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={ownerWhatsAppUrl("Hello Vaishnavi Enterprises, I want to inquire about on-demand trade pricing.")}
              target="_blank"
              rel="noopener noreferrer"
              className="act act-chat act-big"
            >
              <MessageCircle size={20} />
              Inquire Price on WhatsApp
            </a>

            <span className="text-xs text-[var(--fg-quiet)]">
              Usually answered within an hour (Mon–Sat, 9:00 AM – 7:30 PM)
            </span>
          </div>
        </div>
      </section>

      {/* ── 6. TRADE SERVICES BAND (§6.1) ─────────────────────────────── */}
      <section className="band band-paper">
        <div className="wrap">
          <div className="lede">
            <h2>Specialised Services</h2>
            <Link href="/solar">
              Solar Rooftop Details →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Residential Rooftop Solar */}
            <div className="p-8 rounded bg-[var(--mortar)] border border-[var(--rule)] flex flex-col justify-between gap-6">
              <div>
                <div className="w-12 h-12 rounded bg-[var(--copper-wash)] text-[var(--copper-700)] flex items-center justify-center mb-4">
                  <Sun size={26} />
                </div>
                <h3 className="font-bold text-xl text-[var(--fg)] mb-2">
                  Residential Rooftop Solar Assessment
                </h3>
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                  Engineered to your actual electricity bill. We physically survey your terrace in
                  Suriyawan, Bhadohi, or Varanasi before quoting — zero obligation or upfront fees.
                </p>
              </div>

              <div>
                <Link href="/solar" className="act act-fill">
                  Book Free Site Assessment
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* Card 2: Contractor & Bulk Procurement */}
            <div className="p-8 rounded bg-[var(--mortar)] border border-[var(--rule)] flex flex-col justify-between gap-6">
              <div>
                <div className="w-12 h-12 rounded bg-[var(--verdigris-wash)] text-[var(--verdigris-700)] flex items-center justify-center mb-4">
                  <Building2 size={26} />
                </div>
                <h3 className="font-bold text-xl text-[var(--fg)] mb-2">
                  Commercial & Contractor Trade Supply
                </h3>
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                  Bulk order pricing on Polycab cables, Havells switchboards, and street lighting for
                  builders, electrical contractors, and institutional tenders with full 18% GST credit.
                </p>
              </div>

              <div>
                <a
                  href={ownerWhatsAppUrl("Hello, I am an electrical contractor looking for bulk supply rates.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="act act-line"
                >
                  <MessageCircle size={16} />
                  Request Contractor Rate Sheet
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
