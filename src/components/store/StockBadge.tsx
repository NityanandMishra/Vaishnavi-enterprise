import { cn } from "@/lib/utils";

export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BESTSELLER" | "NEW" | null;

/**
 * Every tone is fully opaque. IN_STOCK previously used `bg-success/10`, and it
 * was the only translucent one — laid over a product photo the image showed
 * through and the green label became unreadable, while the solid badges beside
 * it stayed legible. That inconsistency is what made the row look broken.
 */
const styles: Record<Exclude<StockState, null>, { label: string; className: string }> = {
  IN_STOCK: { label: "In Stock", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  LOW_STOCK: { label: "Low Stock", className: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  OUT_OF_STOCK: { label: "Out of Stock", className: "bg-slate-100 text-slate-600 ring-slate-400/30" },
  BESTSELLER: { label: "Bestseller", className: "bg-slate-900 text-white ring-white/10" },
  NEW: { label: "New Launch", className: "bg-brand-orange-600 text-white ring-white/10" },
};

export default function StockBadge({
  state,
  className,
}: {
  state: StockState;
  className?: string;
}) {
  if (!state) return null;
  const { label, className: tone } = styles[state];

  return (
    <span
      className={cn(
        "inline-block flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ring-1",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}

/** Derive the badge state from a product's stock configuration. */
export function stockStateFor(
  stockMode: string,
  isAvailable: boolean,
  totalStock?: number
): StockState {
  if (stockMode === "INQUIRE") return null;
  if (!isAvailable) return "OUT_OF_STOCK";
  if (stockMode === "TRACKED") {
    if (totalStock === undefined) return "IN_STOCK";
    if (totalStock <= 0) return "OUT_OF_STOCK";
    if (totalStock <= 5) return "LOW_STOCK";
  }
  return "IN_STOCK";
}
