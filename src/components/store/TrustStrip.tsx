import { ShieldCheck, FileCheck, Banknote, Truck } from "lucide-react";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Genuine Products",
    desc: "100% authentic directly from authorised distributors",
  },
  {
    icon: FileCheck,
    title: "GST Tax Invoice",
    desc: "Sequential B2B & B2C tax invoice on every order",
  },
  {
    icon: Banknote,
    title: "Cash on Delivery",
    desc: "Pay in cash at your doorstep upon parcel arrival",
  },
  {
    icon: Truck,
    title: "Pan-India Logistics",
    desc: "Dispatched via Delhivery, Blue Dart & India Post",
  },
];

/**
 * Trust & Assurance Strip (§6.1 Item 2)
 *
 * 4 items: Genuine products, GST invoice, Cash on delivery, Delivered pan-India.
 * 2-up on mobile, 4-up at ≥768px.
 * No fabricated statistics or invented numbers.
 */
export default function TrustStrip() {
  return (
    <section className="assure">
      <div className="wrap">
        <div className="assure-in">
          {trustItems.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon size={24} className="flex-shrink-0 text-[var(--copper-lit)]" />
              <div className="min-w-0">
                <span className="block font-bold text-sm text-white tracking-tight">{title}</span>
                <span className="block text-xs text-slate-300 truncate">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
