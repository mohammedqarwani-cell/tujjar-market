/** Shimmering placeholders shown while a page loads, shaped like what's coming. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-card bg-surface ring-1 ring-line/60">
          <div className="skeleton aspect-square" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-3.5 w-4/5 rounded-full" />
            <div className="skeleton h-3.5 w-1/2 rounded-full" />
            <div className="skeleton mt-3 h-3 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="skeleton h-8 w-1/3 rounded-full" />
      <div className="no-scrollbar flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <ProductGridSkeleton />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="skeleton h-4 w-1/3 rounded-full" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="skeleton aspect-square rounded-card" />
        <div className="space-y-4">
          <div className="skeleton h-5 w-24 rounded-full" />
          <div className="skeleton h-8 w-4/5 rounded-full" />
          <div className="skeleton h-8 w-1/3 rounded-full" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-32 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
