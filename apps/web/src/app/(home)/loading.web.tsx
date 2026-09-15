export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-busy="true" aria-label="جارِ التحميل">
      <div className="h-10 w-2/3 animate-pulse rounded-xl bg-sand" />
      <div className="h-5 w-1/2 animate-pulse rounded-lg bg-sand" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-card bg-surface ring-1 ring-line/60">
            <div className="aspect-square animate-pulse bg-sand" />
            <div className="space-y-2 p-3">
              <div className="h-4 animate-pulse rounded bg-sand" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
