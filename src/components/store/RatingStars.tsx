import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact star row + review count, shared by product cards and the PDP header. */
export default function RatingStars({
  rating,
  reviewCount,
  size = 13,
  className,
}: {
  rating: number;
  reviewCount: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={size}
            className={cn(
              i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"
            )}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-slate-700">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted">
        ({reviewCount})
      </span>
    </div>
  );
}
