"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest, useSession } from "@lib/session";
import type { ReviewStatus } from "@lib/types";
import { StarIcon } from "@components/ui/icons";
import { Stars } from "./Stars";

type Mine = {
  canReview: boolean;
  reason: "OWN_STORE" | "NO_CONTACT" | "CONTACT_TOO_OLD" | "TOO_SOON" | null;
  message: string | null;
  availableAt: string | null;
  review: { id: string; rating: number; comment: string | null; status: ReviewStatus } | null;
};

const LABELS = ["", "سيئ", "مقبول", "جيد", "جيد جداً", "ممتاز"];

const STATUS_NOTES: Partial<Record<ReviewStatus, string>> = {
  UNDER_REVIEW: "تقييمك قيد مراجعة الإدارة قبل نشره، لأنه يحتوي رابطاً أو رقماً أو محتوى يحتاج تدقيقاً.",
  HIDDEN: "أخفت الإدارة تقييمك لمخالفته سياسة المحتوى. يمكنك تعديله ليُعاد إلى المراجعة.",
};

const box = "rounded-card bg-surface p-5 ring-1 ring-line";

/** Lets a signed-in buyer who contacted the store rate it, and edit or remove their review. */
export function ReviewComposer({ storeSlug, onChanged }: { storeSlug: string; onChanged: () => void }) {
  const { user } = useSession("web", { lazy: true });
  const pathname = usePathname();
  const [mine, setMine] = useState<Mine | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const data = await apiRequest<Mine>(`/stores/${storeSlug}/reviews/mine`, { audience: "web" });
    setMine(data);
    setRating(data.review?.rating ?? 0);
    setComment(data.review?.comment ?? "");
  };

  useEffect(() => {
    if (user) load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, storeSlug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!rating) return setError("اختر عدد النجوم");
    setBusy(true);
    try {
      await apiRequest(`/stores/${storeSlug}/reviews`, {
        audience: "web",
        method: "POST",
        body: { rating, comment: comment.trim() || undefined },
      });
      setEditing(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ التقييم");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("حذف تقييمك لهذا المتجر؟")) return;
    setBusy(true);
    try {
      await apiRequest(`/stores/${storeSlug}/reviews/mine`, { audience: "web", method: "DELETE" });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حذف التقييم");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    const next = encodeURIComponent(`${pathname}#reviews`);
    return (
      <div className={box}>
        <p className="text-sm leading-7">
          شاركنا تجربتك مع المتجر. التقييم متاح لأصحاب الحسابات الموثّقة الذين تواصلوا مع المتجر من صفحته.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href={`/account/login?next=${next}`} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
            تسجيل الدخول
          </Link>
          <Link href={`/account/register?next=${next}`} className="rounded-xl px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-brand-200">
            حساب جديد
          </Link>
        </div>
      </div>
    );
  }

  if (!mine) return <div className={`${box} h-28 animate-pulse`} aria-busy="true" />;

  if (!mine.canReview) {
    return (
      <div className={box}>
        <p className="text-sm leading-7 text-muted">{mine.message}</p>
        {mine.reason === "NO_CONTACT" && (
          <p className="mt-2 text-xs leading-6 text-muted">
            اضغط «تواصل واتساب» أو «اتصال» في أعلى الصفحة وأنت مسجّل الدخول، ثم عُد بعد نصف ساعة لتقييم تجربتك.
          </p>
        )}
        {mine.availableAt && (
          <p className="mt-2 text-xs text-muted">
            متاح بعد الساعة{" "}
            {new Date(mine.availableAt).toLocaleTimeString("ar-SY-u-nu-latn", { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>
    );
  }

  if (mine.review && !editing) {
    const note = STATUS_NOTES[mine.review.status];
    return (
      <div className={box}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold">تقييمك</span>
          <Stars value={mine.review.rating} />
        </div>
        {mine.review.comment && <p className="mt-2 whitespace-pre-line text-sm leading-7">{mine.review.comment}</p>}
        {note && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs leading-6 text-brand-900">{note}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setEditing(true)} disabled={busy} className="h-9 rounded-xl px-4 text-sm font-bold ring-1 ring-line hover:ring-brand-200">
            تعديل
          </button>
          <button type="button" onClick={remove} disabled={busy} className="h-9 rounded-xl px-4 text-sm text-danger ring-1 ring-danger/30">
            حذف
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${box} space-y-3`} noValidate>
      <div className="text-sm font-bold">{mine.review ? "عدّل تقييمك" : "قيّم تجربتك مع المتجر"}</div>
      <div role="radiogroup" aria-label="عدد النجوم" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} من 5`}
            onClick={() => setRating(i)}
            className="rounded p-0.5"
          >
            <StarIcon size={30} className={i <= rating ? "text-brand-500" : "text-line"} />
          </button>
        ))}
        {rating > 0 && <span className="ms-2 text-sm text-muted">{LABELS[rating]}</span>}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="اكتب تجربتك باختصار (اختياري)"
        className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      <p className="text-xs leading-5 text-muted">يظهر اسمك الأول فقط. الروابط وأرقام الهواتف تُحجز لمراجعة الإدارة قبل النشر.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="h-10 flex-1 rounded-xl bg-ink text-sm font-bold text-canvas transition hover:bg-brand-900 disabled:opacity-60">
          {busy ? "جارِ الحفظ…" : "نشر التقييم"}
        </button>
        {mine.review && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setRating(mine.review!.rating);
              setComment(mine.review!.comment ?? "");
            }}
            className="h-10 rounded-xl px-4 text-sm ring-1 ring-line"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
