import { Star, BadgeCheck } from "lucide-react";
import { truncate } from "@/lib/utils";

export type Testimonial = {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  user: { name: string | null };
  product: { title: string };
};

export default function TestimonialStrip({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto lg:overflow-visible no-scrollbar snap-x snap-mandatory px-4 lg:px-8 max-w-content mx-auto">
      {testimonials.slice(0, 3).map((t) => (
        <div
          key={t.id}
          className="min-w-[280px] lg:min-w-0 snap-start flex flex-col bg-surface border border-border-base rounded-lg p-5"
        >
          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < t.rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}
              />
            ))}
          </div>

          {t.title && <p className="text-sm font-bold text-slate-900 mb-1">{t.title}</p>}
          <p className="text-sm text-slate-600 leading-relaxed flex-1">
            &ldquo;{truncate(t.comment, 160)}&rdquo;
          </p>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border-base">
            <div>
              <p className="text-xs font-bold text-slate-900">{t.user.name || "Verified Customer"}</p>
              <p className="text-[11px] text-muted truncate max-w-[160px]">{t.product.title}</p>
            </div>
            {t.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                <BadgeCheck size={11} /> Verified
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
