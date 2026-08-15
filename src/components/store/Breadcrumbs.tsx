import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1 whitespace-nowrap">
            {item.href && !isLast ? (
              <Link href={item.href} className="text-slate-500 hover:text-brand-orange-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{item.label}</span>
            )}
            {!isLast && <ChevronRight size={14} className="text-muted flex-shrink-0" />}
          </span>
        );
      })}
    </nav>
  );
}
