import { prisma } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Zap, Car, Lightbulb, Wind, Power, BatteryCharging, Cable } from "lucide-react";
import { formatINR, ownerWhatsAppUrl } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
  "fans": <Wind size={28} className="text-brand-orange-500" />,
  "electric-vehicles": <Car size={28} className="text-brand-orange-500" />,
  "led-lighting": <Lightbulb size={28} className="text-brand-orange-500" />,
  "ups-systems": <BatteryCharging size={28} className="text-brand-orange-500" />,
  "electrical-wires": <Cable size={28} className="text-brand-orange-500" />,
  "electrical-fittings": <Power size={28} className="text-brand-orange-500" />,
};

export default async function HomePage() {
  const [topCategories, featuredProducts] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { image: true },
    }),
    prisma.product.findMany({
      where: { checkoutMode: "BUY", isAvailable: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        images: { where: { isMain: true }, include: { image: true }, take: 1 },
        brand: true,
      },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="py-12 md:py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-orange-950/40 border border-brand-orange-900/30 text-brand-orange-400 text-xs font-medium mb-6">
          <Zap size={12} fill="currentColor" />
          Electrical · LED · Fans · EV & Power Backup — Suriyawan
        </div>
        <h1 className="font-heading font-bold text-4xl md:text-6xl text-white leading-tight mb-4">
          Powering Your Home with{" "}
          <span className="bg-gradient-to-r from-brand-orange-400 to-amber-500 bg-clip-text text-transparent">
            Smart Solutions
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          High-performance electric vehicles, genuine wires, modular fittings, and durable power backups. Delivered pan-India.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-orange-600 hover:bg-brand-orange-500 text-white font-semibold transition-colors"
          >
            Browse Products <ArrowRight size={18} />
          </Link>
          <a
            href={ownerWhatsAppUrl("Hello, I am looking for some electrical and EV products.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold transition-colors"
          >
            Chat on WhatsApp
          </a>
        </div>
      </section>

      {/* ── Trust Badges ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
        {[
          { icon: "✅", text: "GST Registered Business" },
          { icon: "🚚", text: "Pan-India Shipping" },
          { icon: "💵", text: "COD Available" },
          { icon: "🔒", text: "Genuine Products Only" },
        ].map(({ icon, text }) => (
          <div key={text} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <p className="text-xs text-slate-300 font-medium leading-tight">{text}</p>
          </div>
        ))}
      </section>

      {/* ── Shop by Category ─────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="font-heading font-bold text-2xl text-white mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {topCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="glass-card rounded-2xl p-5 flex flex-col items-start gap-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center">
                {categoryIcons[cat.slug] ?? <Lightbulb size={28} className="text-slate-400" />}
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-white group-hover:text-brand-orange-400 transition-colors">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{cat.description}</p>
                )}
              </div>
              <ArrowRight size={16} className="text-slate-600 group-hover:text-brand-orange-400 transition-colors mt-auto" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured Products ─────────────────────────────────────────── */}
      {featuredProducts.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-2xl text-white">Featured Products</h2>
            <Link href="/search" className="text-sm text-brand-orange-400 hover:text-brand-orange-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((product) => {
              const mainImage = product.images[0]?.image;
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="glass-card rounded-2xl overflow-hidden group"
                >
                  {/* Image */}
                  <div className="aspect-square bg-slate-800/60 relative overflow-hidden">
                    {mainImage ? (
                      <Image
                        src={mainImage.url}
                        alt={mainImage.alt ?? product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap size={40} className="text-slate-700" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    {product.brand && (
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-brand-orange-500 mb-1">
                        {product.brand.name}
                      </p>
                    )}
                    <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2">
                      {product.title}
                    </h3>
                    <p className="text-sm font-bold text-brand-orange-400">
                      {formatINR(product.basePrice)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
