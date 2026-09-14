"use client";

import { useRef, useState } from "react";
import { FlagIcon, XIcon } from "@components/ui/icons";
import { PUBLIC_API, readError } from "@lib/api";

const REASONS = ["احتيال أو نصب", "منتج ممنوع", "معلومات مضللة", "رقم تواصل لا يعمل", "أخرى"];

export function ReportButton({ storeSlug, productId }: { storeSlug?: string; productId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch(`${PUBLIC_API}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug, productId, reason, details: details || undefined }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال البلاغ");
      setState("idle");
    }
  }

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

        {state === "done" ? (
          <div className="px-5 py-8 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-3 font-bold">وصلنا بلاغك، شكراً لك</p>
            <p className="mt-1 text-sm text-muted">سيراجعه فريق المنصة خلال وقت قصير.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-4">
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
