import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SectionHeading({
  title,
  actionLabel,
  actionHref,
  hint,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  hint?: string;
}) {
  return (
    <div className="flex justify-between items-end gap-4 mb-6">
      <h2 className="text-xl lg:text-2xl font-semibold text-slate-900">{title}</h2>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="flex items-center gap-1 text-sm font-medium text-brand-orange-600 hover:text-brand-orange-700 transition-colors whitespace-nowrap"
        >
          {actionLabel} <ArrowRight size={16} />
        </Link>
      )}
      {hint && <span className="text-xs text-muted lg:hidden whitespace-nowrap">{hint}</span>}
    </div>
  );
}
