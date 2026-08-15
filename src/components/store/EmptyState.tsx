import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="bg-surface border border-border-base rounded-lg py-16 px-6 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-alt flex items-center justify-center">
        <Icon size={26} className="text-muted" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-600 max-w-sm mx-auto">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center min-h-[44px] px-6 rounded-md bg-brand-orange-600 text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
