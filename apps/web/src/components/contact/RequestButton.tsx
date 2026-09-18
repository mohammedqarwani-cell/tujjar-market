"use client";

import { useEffect, useState } from "react";
import { PUBLIC_API, readError } from "@lib/api";
import { useSession } from "@lib/session";
import { toast, haptic } from "@lib/toast";
import { Portal } from "@components/ui/Portal";
import { Field, FormError, inputClass, textareaClass } from "@components/forms/fields";
import { XIcon } from "@components/ui/icons";

type Props = {
  store: { slug: string; name: string };
  product?: { id: string; title: string };
  className?: string;
};

const SENT_KEY = "tj_request_contact";

/**
 * Sends the shop a written request (name, number, quantity) instead of a WhatsApp message.
 * The shop finds it in its dashboard, so a request is never lost in a busy chat.
 */
export function RequestButton({ store, product, className = "" }: Props) {
  const { user } = useSession("web", { lazy: true });
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", quantity: "", note: "" });

  // Fills in what the buyer typed last time (kept on this phone only)
  useEffect(() => {
    if (!open) return;
    let saved: { name?: string; phone?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}");
    } catch {}
    setForm((f) => ({ ...f, name: f.name || user?.name || saved.name || "", phone: f.phone || saved.phone || "" }));
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${PUBLIC_API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client": "web" },
        credentials: "include",
        body: JSON.stringify({
          storeSlug: store.slug,
          productId: product?.id,
          name: form.name,
          phone: form.phone,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          note: form.note || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      try {
        localStorage.setItem(SENT_KEY, JSON.stringify({ name: form.name, phone: form.phone }));
      } catch {}
      haptic(18);
      setSent(true);
      toast("وصل طلبك للمتجر", "🛎");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setSent(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`press flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-white shadow-sm transition hover:bg-brand-700 ${className}`}
      >
        🛎 اطلب من المتجر
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`طلب من ${store.name}`}
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{sent ? "وصل طلبك ✓" : `اطلب من ${store.name}`}</h2>
                  {!sent && (
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {product ? `«${product.title}»` : "اكتب طلبك"} — يصل الطلب للتاجر مباشرة ويرد عليك على رقمك.
                    </p>
                  )}
                </div>
                <button type="button" onClick={close} aria-label="إغلاق" className="shrink-0 rounded-lg p-1 text-muted hover:bg-sand">
                  <XIcon size={20} />
                </button>
              </div>

              {sent ? (
                <div className="space-y-4">
                  <p className="rounded-xl bg-olive-50 px-4 py-3 text-sm leading-7 text-olive-700">
                    التاجر شاف طلبك بلوحته ووصله إشعار. رح يتواصل معك على الرقم يلي كتبته. رقمك ما بيظهر لغير هالمتجر.
                  </p>
                  <button type="button" onClick={close} className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white">
                    تمام
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Field label="اسمك">
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      minLength={2}
                      maxLength={60}
                      autoComplete="name"
                      placeholder="مثال: أبو أحمد"
                    />
                  </Field>
                  <Field label="رقم الموبايل" hint="يشوفه صاحب هالمتجر فقط، ليرد عليك.">
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      placeholder="09xxxxxxxx"
                    />
                  </Field>
                  {product && (
                    <Field label="الكمية" optional>
                      <input
                        className={inputClass}
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        inputMode="numeric"
                        placeholder="1"
                      />
                    </Field>
                  )}
                  <Field label="ملاحظة للتاجر" optional>
                    <textarea
                      className={textareaClass}
                      rows={3}
                      maxLength={500}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder={product ? "مثال: بدي ياه لون أسود، وقت التوصيل؟" : "شو بتحتاج من المتجر؟"}
                    />
                  </Field>
                  <FormError message={error} />
                  <button type="submit" disabled={busy} className="press h-12 w-full rounded-xl bg-brand-600 font-bold text-white disabled:opacity-60">
                    {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
                  </button>
                  <p className="text-center text-xs leading-5 text-muted">بإرسال الطلب توافق على مشاركة اسمك ورقمك مع هذا المتجر فقط.</p>
                </form>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
