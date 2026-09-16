"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { webUrl } from "@lib/urls";
import { displayPhone, timeAgo } from "@lib/format";
import { adminFetch, apiRequest } from "@lib/session";
import type { Page, ReviewStatus } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { Stars } from "@components/reviews/Stars";

type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  moderationNote: string | null;
  merchantReply: string | null;
  flagOpen: boolean;
  flagReason: string | null;
  flaggedAt: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { name: string; phone: string; createdAt: string };
  store: { slug: string; name: string };
  moderatedBy: { name: string } | null;
  contact: { firstContactAt: string; lastContactAt: string; contacts: number } | null;
};

const FILTERS = [
  { value: "UNDER_REVIEW", label: "محجوزة للمراجعة" },
  { value: "flagged", label: "طلب التاجر مراجعتها" },
  { value: "HIDDEN", label: "مخفية" },
  { value: "PUBLISHED", label: "منشورة" },
];

const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";

/** Moderation queue: held reviews, reviews merchants asked about, and past decisions. */
export function ReviewsTab() {
  const [filter, setFilter] = useState("UNDER_REVIEW");
  const [data, setData] = useState<Page<AdminReview> | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const query = filter === "flagged" ? "flagged=1" : `status=${filter}`;
      setData(await adminFetch<Page<AdminReview>>(`/admin/reviews?${query}&pageSize=50`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-3">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <p className="text-xs leading-6 text-muted">
        التقييم متاح فقط لمن تواصل مع المتجر من صفحته. التقييمات التي فيها روابط أو أرقام أو مواد ممنوعة تُحجز هنا تلقائياً، وطلب
        التاجر للمراجعة لا يخفي التقييم حتى تقرروا.
      </p>
      <FormError message={error} />
      {data?.items.length === 0 && <EmptyState icon="✅" title="لا توجد تقييمات في هذه القائمة" />}
      {data?.items.map((review) => <ReviewRow key={review.id} review={review} onDone={load} />)}
    </div>
  );
}

function ReviewRow({ review: r, onDone }: { review: AdminReview; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(status: "PUBLISHED" | "HIDDEN") {
    setError("");
    if (status === "HIDDEN" && note.trim().length < 5) return setError("اكتب سبب الإخفاء (5 أحرف على الأقل)");
    setBusy(true);
    try {
      await apiRequest(`/admin/reviews/${r.id}`, {
        audience: "admin",
        method: "PATCH",
        body: { status, note: note.trim() || undefined },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ القرار");
      setBusy(false);
    }
  }

  return (
    <article className="rounded-card bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={r.rating} size={15} />
            <Link href={webUrl(`/stores/${r.store.slug}#reviews`)} target="_blank" className="font-bold hover:text-brand-700">
              {r.store.name}
            </Link>
            {r.flagOpen && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">طلب التاجر مراجعته</span>}
          </div>
          <div className="text-xs leading-6 text-muted">
            الكاتب: <span className="font-bold text-ink">{r.buyer.name}</span> ·{" "}
            <a href={`tel:+${r.buyer.phone}`} dir="ltr" className="text-brand-700">
              {displayPhone(r.buyer.phone)}
            </a>{" "}
            · حسابه منذ {timeAgo(r.buyer.createdAt)} · كُتب {timeAgo(r.updatedAt)}
          </div>
          <div className="text-xs leading-6 text-muted">
            {r.contact
              ? `تواصل مع المتجر ${r.contact.contacts} مرة، أولها ${timeAgo(r.contact.firstContactAt)}`
              : "لا يوجد سجل تواصل"}
          </div>
        </div>
      </div>

      {r.comment && <p className="mt-3 whitespace-pre-line rounded-xl bg-sand px-3 py-2 text-sm leading-7">{r.comment}</p>}
      {r.merchantReply && <p className="mt-2 text-xs leading-6 text-muted">رد التاجر: {r.merchantReply}</p>}
      {r.moderationNote && <p className="mt-2 text-xs font-bold text-brand-700">{r.moderationNote}</p>}
      {r.flagReason && <p className="mt-1 text-xs text-danger">سبب طلب التاجر: {r.flagReason}</p>}
      {r.moderatedBy && r.moderatedAt && (
        <p className="mt-1 text-xs text-muted">
          آخر قرار: {r.moderatedBy.name} {timeAgo(r.moderatedAt)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="ملاحظة القرار (إلزامية عند الإخفاء)"
          className="h-9 min-w-[14rem] flex-1 rounded-xl border border-line bg-surface px-3 text-sm"
        />
        {r.status !== "PUBLISHED" || r.flagOpen ? (
          <button type="button" disabled={busy} onClick={() => decide("PUBLISHED")} className={`${chip} bg-olive-500 text-white ring-olive-500`}>
            نشر
          </button>
        ) : null}
        {r.status !== "HIDDEN" && (
          <button type="button" disabled={busy} onClick={() => decide("HIDDEN")} className={`${chip} text-danger ring-danger/30`}>
            إخفاء
          </button>
        )}
      </div>
      <FormError message={error} />
    </article>
  );
}
