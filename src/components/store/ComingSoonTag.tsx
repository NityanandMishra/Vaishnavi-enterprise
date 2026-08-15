import { cn } from "@/lib/utils";

/**
 * Marks a subcategory or brand the admin has created but not yet stocked.
 *
 * These used to be hidden outright, which made the admin panel look broken —
 * you create a subcategory, it never appears on the storefront, and nothing
 * explains why. Showing them labelled keeps the catalogue honest in both
 * directions: the admin sees their work, and the shopper learns something is
 * on the way rather than clicking into an empty listing.
 *
 * Entries carrying this tag are always rendered inert, never as live links.
 */
export default function ComingSoonTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
        className
      )}
    >
      Soon
    </span>
  );
}
