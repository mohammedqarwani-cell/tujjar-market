"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest, useSession } from "@lib/session";
import { displayPhone } from "@lib/format";
import { toast, haptic } from "@lib/toast";
import { Portal } from "@components/ui/Portal";
import { Field, FormError, inputClass, textareaClass } from "@components/forms/fields";
import { XIcon } from "@components/ui/icons";

type Props = {
  store: { slug: string; name: string };
  product?: { id: string; title: string };
  className?: string;
};

/**
 * Sends the shop a written request instead of a WhatsApp message: it waits in the shop's
 * dashboard until answered. The buyer signs in first, so the shop gets the name and number
 * from their account rather than whatever they type.
 */
export function RequestButton({ store, product, className = "" }: Props) {
  const { status, user } = useSession("web", { lazy: true });
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

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
      await apiRequest("/leads", {
        audience: "web",
        method: "POST",
        body: {
          storeSlug: store.slug,
          productId: product?.id,
          quantity: quantity ? Number(quantity) : undefined,
          note: note || undefined,
        },
      });
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
    setQuantity("");
    setNote("");
  };

  const signedIn = status === "authenticated" && user?.role === "BUYER";
  const loginHref = `/account/login?next=${encodeURIComponent(pathname)}`;

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
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
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
                      {product ? `«${product.title}»` : "استفسار عن المتجر"} — يصل الطلب للتاجر مباشرة ويرد عليك على رقمك.
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
                    التاجر شاف طلبك بلوحته ووصله إشعار. رح يتواصل معك على رقمك. رقمك ما بيظهر لغير هالمتجر.
                  </p>
                  <button type="button" onClick={close} className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white">
                    تمام
                  </button>
                </div>
              ) : status === "loading" || status === "unknown" ? (
                <div className="h-28 animate-pulse rounded-xl bg-sand" aria-busy="true" />
              ) : !signedIn ? (
                <div className="space-y-4">
                  <p className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">
                    سجّل دخولك لتبعت طلبك. منرسل للتاجر اسمك ورقمك من حسابك، فما بتحتاج تكتبهم كل مرة،
                    وبيوصلك رده، وبتقدر تقيّم المتجر بعد ما تشتري.
                  </p>
                  <Link href={loginHref} className="press flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
                    تسجيل الدخول
                  </Link>
                  <p className="text-center text-sm text-muted">
                    ما عندك حساب؟{" "}
                    <Link href={`/account/register?next=${encodeURIComponent(pathname)}`} className="font-bold text-brand-700">
                      أنشئ حساباً بدقيقة
                    </Link>
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <div className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">
                    <div className="font-bold">{user.name}</div>
                    <bdi dir="ltr" className="text-muted">{displayPhone(user.phone)}</bdi>
                    <div className="mt-1 text-xs text-muted">
                      منرسل هالاسم والرقم للتاجر.{" "}
                      <Link href="/account/phone" className="font-medium text-brand-700">تغيير الرقم</Link>
                    </div>
                  </div>
                  {product && (
                    <Field label="الكمية" optional>
                      <input
                        className={inputClass}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
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
