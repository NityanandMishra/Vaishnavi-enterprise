import { cn } from "@/lib/utils";

export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BESTSELLER" | "NEW" | null;

const styles: Record<Exclude<StockState, null>, { label: string; className: string }> = {
  IN_STOCK: { label: "In Stock", className: "bg-success/10 text-success" },
  LOW_STOCK: { label: "Low Stock", className: "bg-danger text-white" },
  OUT_OF_STOCK: { label: "Out of Stock", className: "bg-slate-200 text-slate-600" },
  BESTSELLER: { label: "Bestseller", className: "bg-slate-900 text-white" },
  NEW: { label: "New Launch", className: "bg-slate-900 text-white" },
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
        "inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm",
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
