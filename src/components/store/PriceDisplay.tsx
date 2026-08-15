import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils";

export default function PriceDisplay({
  price,
  mrp,
  size = "card",
  note,
  className,
}: {
  price: number;
  mrp?: number | null;
  size?: "card" | "display";
  note?: string;
  className?: string;
}) {
  const hasDiscount = typeof mrp === "number" && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-bold text-brand-orange-600",
            size === "display" ? "text-2xl" : "text-lg"
          )}
        >
          {formatINR(price)}
        </span>
        {hasDiscount && (
          <>
            <span className="text-sm text-muted line-through">{formatINR(mrp)}</span>
            <span className="text-xs font-bold text-success">{discountPct}% OFF</span>
          </>
        )}
      </div>
      {note && <p className="text-xs text-slate-600 mt-1">{note}</p>}
    </div>
  );
}
