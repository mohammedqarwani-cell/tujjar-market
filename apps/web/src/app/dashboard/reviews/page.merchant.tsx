"use client";

import { useState } from "react";
import { merchantFetch } from "@lib/session";
import { useAuthData } from "@lib/merchant";
import { timeAgo } from "@lib/format";
import type { Page, PublicReview, ReviewStatus } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { Stars } from "@components/reviews/Stars";

type MerchantReview = PublicReview & { status: ReviewStatus; flagOpen: boolean; flagReason: string | null };
type MerchantReviewPage = Page<MerchantReview> & { summary: { average: number; count: number } };

const STATUS: Record<ReviewStatus, [string, string]> = {
  PUBLISHED: ["منشور", "bg-olive-50 text-olive-700"],
  UNDER_REVIEW: ["قيد مراجعة الإدارة", "bg-brand-50 text-brand-700"],
  HIDDEN: ["مخفي", "bg-sand text-muted"],
};

export default function MerchantReviewsPage() {
  const [status, setStatus] = useState("");
  const { data, error, reload } = useAuthData<MerchantReviewPage>(
    `/merchant/reviews?pageSize=50${status ? `&status=${status}` : ""}`,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تقييمات الزبائن</h1>
          <p className="mt-1 max-w-xl text-sm leading-7 text-muted">
            يقيّمك فقط من تواصل معك من صفحة متجرك. ردّك يظهر للجميع تحت التقييم، ولا يُحذف أي تقييم إلا بقرار من الإدارة.
          </p>
        </div>
        {data && data.summary.count > 0 && (
          <div className="text-end">
            <div className="text-3xl font-bold">{data.summary.average.toFixed(1)}</div>
            <Stars value={data.summary.average} />
            <div className="text-xs text-muted">{data.summary.count} تقييم منشور</div>
          </div>
        )}
      </div>

      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
        <option value="">كل التقييمات</option>
        <option value="PUBLISHED">المنشورة</option>
        <option value="UNDER_REVIEW">قيد المراجعة</option>
        <option value="HIDDEN">المخفية</option>
      </select>

      <FormError message={error} />
      {data?.items.length === 0 && (
        <EmptyState icon="⭐" title="لا توجد تقييمات بعد">
          شارك رابط متجرك مع زبائنك؛ من يتواصل معك عبره يستطيع تقييمك.
        </EmptyState>
      )}
      {data?.items.map((review) => <ReviewCard key={review.id} review={review} onChanged={reload} />)}
    </div>
  );
}

function ReviewCard({ review: r, onChanged }: { review: MerchantReview; onChanged: () => void }) {
  const [mode, setMode] = useState<"" | "reply" | "flag">("");
  const [reply, setReply] = useState(r.merchantReply ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setMode("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  const [label, style] = STATUS[r.status];

  return (
    <article className="rounded-card bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{r.author}</span>
          <Stars value={r.rating} size={14} />
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style}`}>{label}</span>
          {r.flagOpen && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">طلبت مراجعته</span>
          )}
        </div>
        <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
      </div>
      {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-7">{r.comment}</p>}
      {r.merchantReply && mode !== "reply" && (
        <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm leading-7">
          <span className="text-xs font-bold text-brand-700">ردّك</span>
          <p className="whitespace-pre-line">{r.merchantReply}</p>
        </div>
      )}

      {mode === "reply" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="اكتب ردّاً مهذباً يظهر للجميع تحت التقييم"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            disabled={busy || reply.trim().length < 2}
            onClick={() => run(() => merchantFetch(`/merchant/reviews/${r.id}/reply`, { method: "PATCH", body: { reply } }))}
            className="h-9 rounded-xl bg-ink px-4 text-sm font-bold text-canvas disabled:opacity-60"
          >
            نشر الرد
          </button>
        </div>
      )}

      {mode === "flag" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="لماذا تطلب مراجعة هذا التقييم؟ مثال: الشخص لم يتعامل معنا، أو يحتوي إساءة"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <p className="text-xs text-muted">يبقى التقييم ظاهراً حتى تقرر الإدارة.</p>
          <button
            type="button"
            disabled={busy || reason.trim().length < 5}
            onClick={() => run(() => merchantFetch(`/merchant/reviews/${r.id}/flag`, { method: "POST", body: { reason } }))}
            className="h-9 rounded-xl bg-danger px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            إرسال للإدارة
          </button>
        </div>
      )}

      <FormError message={error} />
      <div className="mt-3 flex flex-wrap gap-2">
        {r.status === "PUBLISHED" && (
          <button type="button" onClick={() => setMode(mode === "reply" ? "" : "reply")} className="h-8 rounded-lg px-3 text-xs font-bold ring-1 ring-line hover:ring-brand-200">
            {mode === "reply" ? "إلغاء" : r.merchantReply ? "تعديل الرد" : "ردّ على التقييم"}
          </button>
        )}
        {!r.flagOpen && (
          <button type="button" onClick={() => setMode(mode === "flag" ? "" : "flag")} className="h-8 rounded-lg px-3 text-xs text-muted ring-1 ring-line hover:text-danger">
            {mode === "flag" ? "إلغاء" : "طلب مراجعة من الإدارة"}
          </button>
        )}
      </div>
    </article>
  );
}
