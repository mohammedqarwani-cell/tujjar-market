"use client";

import { useCallback, useState } from "react";
import { apiRequest } from "@lib/session";
import { timeAgo } from "@lib/format";
import type { PublicReview, ReviewPage } from "@lib/types";
import { Stars } from "./Stars";
import { ReviewComposer } from "./ReviewComposer";

const PAGE_SIZE = 5;

/** Store rating summary, the buyer's own review form, and the published reviews with merchant replies. */
export function StoreReviews({ storeSlug, storeName, initial }: { storeSlug: string; storeName: string; initial: ReviewPage }) {
  const [page, setPage] = useState(initial);
  const [items, setItems] = useState<PublicReview[]>(initial.items);
  const [loading, setLoading] = useState(false);

  const fetchPage = (n: number) =>
    apiRequest<ReviewPage>(`/stores/${storeSlug}/reviews?pageSize=${PAGE_SIZE}&page=${n}`, { audience: "web" });

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchPage(1);
      setPage(fresh);
      setItems(fresh.items);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug]);

  async function loadMore() {
    setLoading(true);
    try {
      const next = await fetchPage(page.page + 1);
      setPage(next);
      setItems((prev) => [...prev, ...next.items]);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const { summary } = page;

  return (
    <section id="reviews" className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-bold">تقييمات الزبائن</h2>
      <div className={`mt-4 grid items-start gap-4 ${items.length ? "lg:grid-cols-[18rem_1fr]" : "md:grid-cols-2"}`}>
        <aside className={items.length ? "space-y-4" : "contents"}>
          <div className="rounded-card bg-surface p-5 ring-1 ring-line">
            {summary.count ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">{summary.average.toFixed(1)}</span>
                  <span className="pb-1 text-sm text-muted">من 5</span>
                </div>
                <Stars value={summary.average} size={18} className="mt-1" />
                <p className="mt-1 text-xs text-muted">{summary.count} تقييم من زبائن تواصلوا مع المتجر</p>
                <ul className="mt-4 space-y-1.5">
                  {summary.distribution.map((d) => (
                    <li key={d.rating} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-muted">{d.rating}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(d.count / summary.count) * 100}%` }} />
                      </span>
                      <span className="w-6 text-end text-muted">{d.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm leading-7 text-muted">لا توجد تقييمات بعد. تواصل مع {storeName} وكن أول من يقيّم.</p>
            )}
          </div>
          <ReviewComposer storeSlug={storeSlug} onChanged={reload} />
        </aside>

        <div className={items.length ? "space-y-3" : "hidden"}>
          {items.map((r) => (
            <article key={r.id} className="rounded-card bg-surface p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{r.author}</span>
                  <Stars value={r.rating} size={14} />
                </div>
                <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-7">{r.comment}</p>}
              {r.merchantReply && (
                <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm leading-7">
                  <span className="text-xs font-bold text-brand-700">رد المتجر</span>
                  <p className="whitespace-pre-line">{r.merchantReply}</p>
                </div>
              )}
            </article>
          ))}
          {items.length < page.total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="h-11 w-full rounded-xl font-medium ring-1 ring-line hover:ring-brand-200 disabled:opacity-60"
            >
              {loading ? "جارِ التحميل…" : "عرض تقييمات أكثر"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
