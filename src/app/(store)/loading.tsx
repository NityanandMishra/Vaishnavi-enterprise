/**
 * Route-transition skeleton for the storefront.
 *
 * Without this the App Router holds the previous page on screen for the whole
 * of a navigation and shows nothing at all in the meantime, so tapping a
 * category read as "the link is broken" — the menu would close and the old
 * page would just sit there. This gives every navigation immediate feedback.
 */
export default function StoreLoading() {
  return (
    <div className="max-w-content mx-auto px-4 lg:px-8 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="h-4 w-40 rounded bg-slate-200 animate-pulse mb-6" />
      <div className="h-8 w-64 rounded bg-slate-200 animate-pulse mb-8" />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border-base rounded-lg p-4">
            <div className="w-full aspect-square rounded-md bg-slate-200 animate-pulse mb-3" />
            <div className="h-3 w-16 rounded bg-slate-200 animate-pulse mb-2" />
            <div className="h-4 w-full rounded bg-slate-200 animate-pulse mb-1.5" />
            <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse mb-4" />
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
