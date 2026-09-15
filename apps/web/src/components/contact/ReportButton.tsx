"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, XIcon } from "@components/ui/icons";
import { apiRequest, useSession } from "@lib/session";

const REASONS = ["احتيال أو نصب", "منتج ممنوع", "معلومات مضللة", "رقم تواصل لا يعمل", "أخرى"];

export function ReportButton({ storeSlug, productId }: { storeSlug?: string; productId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const { user } = useSession("web", { lazy: true });
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await apiRequest("/reports", {
        audience: "web",
        method: "POST",
        body: { storeSlug: productId ? undefined : storeSlug, productId, reason, details: details || undefined },
      });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال البلاغ");
      setState("idle");
    }
  }

  const next = encodeURIComponent(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger"
      >
        <FlagIcon size={14} />
        إبلاغ
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-card bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
        onClose={() => state === "done" && setState("idle")}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-bold">إبلاغ عن مخالفة</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="إغلاق" className="text-muted hover:text-ink">
            <XIcon />
          </button>
        </div>

        {!user ? (
          <div className="px-5 py-6 text-center">
            <p className="leading-7">للإبلاغ يلزم حساب موثّق برقم موبايل، حتى نتابع البلاغ معك ونمنع البلاغات الكيدية.</p>
            <p className="mt-2 text-xs text-muted">اسمك ورقمك يظهران لإدارة المنصة فقط، ولا يراهما التاجر.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href={`/account/login?next=${next}`} className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700">
                تسجيل الدخول
              </Link>
              <Link href={`/account/register?next=${next}`} className="rounded-xl px-5 py-2.5 font-bold ring-1 ring-line hover:ring-brand-200">
                حساب جديد
              </Link>
            </div>
          </div>
        ) : state === "done" ? (
          <div className="px-5 py-8 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-3 font-bold">وصلنا بلاغك، شكراً لك</p>
            <p className="mt-1 text-sm text-muted">سيراجعه فريق المنصة وقد نتواصل معك على رقمك.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-4">
            <p className="text-xs text-muted">يُرسل البلاغ باسم {user.name}. لا يظهر اسمك للتاجر.</p>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">سبب البلاغ</legend>
              {REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-line has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-200">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-brand-600" />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </fieldset>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="تفاصيل إضافية (اختياري)"
              className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              disabled={state === "sending"}
              className="h-11 w-full rounded-xl bg-danger font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {state === "sending" ? "جارِ الإرسال…" : "إرسال البلاغ"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
