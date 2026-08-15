import { Banknote, Truck, ShieldCheck } from "lucide-react";

const items = [
  { icon: Banknote, label: "COD Available" },
  { icon: Truck, label: "Pan-India Shipping" },
  { icon: ShieldCheck, label: "GST Invoice" },
];

export default function TrustStrip() {
  return (
    <section className="bg-surface-sunken border-y border-border-base py-5 overflow-x-auto no-scrollbar">
      <div className="max-w-content mx-auto px-4 lg:px-8 flex items-center justify-start lg:justify-center gap-8 min-w-max">
        {items.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex items-center gap-6">
            {i > 0 && <span className="h-4 w-px bg-border-base" aria-hidden />}
            <div className="flex items-center gap-2">
              <Icon size={18} className="text-slate-900" />
              <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap text-slate-900">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
