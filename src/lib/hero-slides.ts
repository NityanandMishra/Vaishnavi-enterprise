/**
 * Hero carousel slides.
 *
 * Hardcoded on purpose. These were previously read from the category table,
 * which meant the hero inherited whatever product photo an admin happened to
 * upload — low-resolution shots stretched full-bleed, which looked broken.
 * Marketing imagery is an editorial decision, so it lives here instead.
 *
 * `image` points at a file under public/hero/. Until one exists the slide
 * renders its designed backdrop, which is a finished look in its own right —
 * drop in `public/hero/<key>.jpg` (landscape, 2000px wide or more) and it
 * layers in automatically behind the scrim. No code change needed.
 */

export type HeroAccent = {
  /** Primary wash, top-right. */
  from: string;
  /** Secondary wash, bottom-left. */
  to: string;
  /** Tint for the eyebrow label. */
  chip: string;
};

export type HeroSlide = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  /** Optional photograph; falls back to the designed backdrop when absent. */
  image: string | null;
  icon: "car" | "sun" | "fan" | "battery" | "cable";
  accent: HeroAccent;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    key: "electric-vehicles",
    eyebrow: "Electric Mobility",
    title: "Electric scooters, built for Indian roads",
    description:
      "Smart e-scooties, e-rickshaws, and e-cycles from trusted makers — with on-road support and genuine spares.",
    href: "/categories/electric-vehicles",
    ctaLabel: "Shop Electric Vehicles",
    image: "/hero/electric-vehicles.jpg",
    icon: "car",
    accent: {
      from: "rgba(234,88,12,0.55)",
      to: "rgba(88,28,7,0.45)",
      chip: "text-brand-orange-300",
    },
  },
  {
    key: "solar",
    eyebrow: "Solar Solutions",
    title: "Lower your electricity bill, permanently",
    description:
      "Rooftop solar for homes and housing societies, plus solar lighting for gates and outdoor areas. Free site assessment.",
    href: "/solar",
    ctaLabel: "Book a free assessment",
    image: "/hero/solar.jpg",
    icon: "sun",
    accent: {
      from: "rgba(245,158,11,0.52)",
      to: "rgba(120,53,15,0.42)",
      chip: "text-amber-300",
    },
  },
  {
    key: "fans",
    eyebrow: "Air Comfort",
    title: "BLDC fans that pay for themselves",
    description:
      "Energy-efficient ceiling, wall, and pedestal fans running at a fraction of the power of conventional motors.",
    href: "/categories/fans",
    ctaLabel: "Shop Fans",
    image: "/hero/fans.jpg",
    icon: "fan",
    accent: {
      from: "rgba(56,189,248,0.48)",
      to: "rgba(12,74,110,0.45)",
      chip: "text-sky-300",
    },
  },
  {
    key: "ups-systems",
    eyebrow: "Power Backup",
    title: "Never lose power mid-shift",
    description:
      "Inverters, batteries, and UPS systems sized to your load — installed, commissioned, and serviced locally.",
    href: "/categories/ups-systems",
    ctaLabel: "Shop UPS & Backup",
    image: "/hero/ups-systems.jpg",
    icon: "battery",
    accent: {
      from: "rgba(16,185,129,0.45)",
      to: "rgba(4,63,47,0.45)",
      chip: "text-emerald-300",
    },
  },
  {
    key: "electrical-wires",
    eyebrow: "Wiring & Cables",
    title: "FR copper wiring you can trust behind the wall",
    description:
      "Flame-retardant multi-strand copper cable from Finolex and other tier-1 brands, with GST invoicing.",
    href: "/categories/electrical-wires",
    ctaLabel: "Shop Wires & Cables",
    image: "/hero/electrical-wires.jpg",
    icon: "cable",
    accent: {
      from: "rgba(168,85,247,0.45)",
      to: "rgba(59,7,100,0.45)",
      chip: "text-fuchsia-300",
    },
  },
];
