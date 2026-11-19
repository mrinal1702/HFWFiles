/**
 * Grey placeholder shown by `loading.tsx` files while a page's data loads, so a click shows the
 * new page at once and the numbers fill in a moment later. Pure markup (no data, no client JS).
 */

function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block rounded-md bg-slate-200/80 ${className}`} />;
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-slate-200" />
      <Bar className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bar className="h-9 w-9 shrink-0 rounded-full" />
            <Bar className={`h-4 ${i % 2 === 0 ? "w-3/5" : "w-2/5"}`} />
            <Bar className="ml-auto h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Content area of an in-auction page (header and side menu stay on screen). */
export function AuctionContentSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="flex gap-2">
        <Bar className="h-9 w-28 rounded-xl" />
        <Bar className="h-9 w-24 rounded-xl" />
        <Bar className="hidden h-9 w-24 rounded-xl sm:block" />
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  );
}

/** Dashboard-style list of auction cards. */
export function CardListSkeleton() {
  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <div role="status" aria-live="polite" className="animate-pulse space-y-4">
        <span className="sr-only">Loading…</span>
        <div className="flex items-center gap-3">
          <Bar className="h-14 w-14 rounded-full" />
          <Bar className="h-5 w-36" />
        </div>
        <Bar className="h-10 w-full rounded-xl" />
        <Bar className="h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-slate-200" />
            <Bar className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bar className="h-5 w-1/2" />
              <Bar className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
