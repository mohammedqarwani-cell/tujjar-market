"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiGet } from "@lib/api";
import { apiRequest, useSession } from "@lib/session";
import { clearStoreCart, setQuantity, type StoreCart } from "@lib/cart";
import { displayPhone, formatNumber, priceLabel } from "@lib/format";
import { toast, haptic } from "@lib/toast";
import type { Currency } from "@lib/types";
import { Portal } from "@components/ui/Portal";
import { Field, FormError, inputClass, textareaClass } from "@components/forms/fields";
import { XIcon } from "@components/ui/icons";

type Fulfillment = "DELIVERY" | "PICKUP";
type Payment = "CASH_ON_DELIVERY" | "CASH_AT_SHOP" | "TRANSFER";
type GovOption = { id: string; name: string };

const ADDRESS_KEY = "tj_address";

const PAYMENTS: Record<Fulfillment, { id: Payment; label: string; hint: string }[]> = {
  DELIVERY: [
    { id: "CASH_ON_DELIVERY", label: "نقداً عند الاستلام", hint: "تدفع للمندوب لما يوصلك الطلب" },
    { id: "TRANSFER", label: "حوالة أو تحويل", hint: "تتفق مع التاجر على طريقة التحويل" },
  ],
  PICKUP: [
    { id: "CASH_AT_SHOP", label: "نقداً في المحل", hint: "تدفع لما تستلم من المحل" },
    { id: "TRANSFER", label: "حوالة أو تحويل", hint: "تتفق مع التاجر على طريقة التحويل" },
  ],
};

/** Fetched once per visit, the first time someone opens a checkout */
let govCache: Promise<GovOption[]> | null = null;
const loadGovernorates = () => {
  govCache ??= apiGet<(GovOption & { status: string })[]>("/governorates", 300)
    .then((list) => list.filter((g) => g.status === "ACTIVE").map(({ id, name }) => ({ id, name })))
    .catch(() => {
      govCache = null;
      return [];
    });
  return govCache;
};

const money = (value: number, currency: Currency) => priceLabel({ price: value, currency, priceType: "FIXED" }).main;

/**
 * Sends one shop's basket as an order: the lines and their total, delivery or pickup,
 * the address and how it is paid. Name and number come from the buyer's account.
 */
export function CheckoutDialog({ cart, onClose }: { cart: StoreCart; onClose: () => void }) {
  const { status, user } = useSession("web", { lazy: true });
  const pathname = usePathname();
  const [done, setDone] = useState<{ ref: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [governorates, setGovernorates] = useState<GovOption[]>([]);

  const [fulfillment, setFulfillment] = useState<Fulfillment>(cart.store.hasDelivery ? "DELIVERY" : "PICKUP");
  const [payment, setPayment] = useState<Payment>(cart.store.hasDelivery ? "CASH_ON_DELIVERY" : "CASH_AT_SHOP");
  const [governorateId, setGovernorateId] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void loadGovernorates().then(setGovernorates);
    try {
      const saved = JSON.parse(localStorage.getItem(ADDRESS_KEY) ?? "{}");
      setAddress((a) => a || saved.address || "");
      setGovernorateId((g) => g || saved.governorateId || "");
    } catch {}
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!PAYMENTS[fulfillment].some((p) => p.id === payment)) setPayment(PAYMENTS[fulfillment][0].id);
  }, [fulfillment, payment]);

  const currency = cart.items[0]?.currency ?? "SYP";
  const priced = cart.items.every((i) => i.priceType === "FIXED" && i.price !== null);
  const total = priced ? cart.items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0) : null;
  const pieces = cart.items.reduce((n, i) => n + i.quantity, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await apiRequest<{ ref: number }>("/orders", {
        audience: "web",
        method: "POST",
        body: {
          items: cart.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          fulfillment,
          payment,
          governorateId: fulfillment === "DELIVERY" ? governorateId || undefined : undefined,
          address: fulfillment === "DELIVERY" ? address : undefined,
          note: note || undefined,
        },
      });
      if (fulfillment === "DELIVERY") {
        try {
          localStorage.setItem(ADDRESS_KEY, JSON.stringify({ address, governorateId }));
        } catch {}
      }
      haptic(18);
      clearStoreCart(cart.store.slug);
      setDone(order);
      toast("وصل طلبك للمتجر", "🛒");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  };

  const signedIn = status === "authenticated" && user?.role === "BUYER";

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`طلب من ${cart.store.name}`}
          onClick={(e) => e.stopPropagation()}
          className="animate-slide-up max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{done ? `وصل طلبك #${done.ref} ✓` : "تفاصيل الطلب"}</h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {cart.store.name} · {formatNumber(cart.items.length)} صنف ({formatNumber(pieces)} قطعة)
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="shrink-0 rounded-lg p-1 text-muted hover:bg-sand">
              <XIcon size={20} />
            </button>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-olive-50 px-4 py-3 text-sm leading-7 text-olive-700">
                وصل طلبك للتاجر ووصله إشعار. رح يأكدلك السعر النهائي وأجرة التوصيل ووقت التسليم، وبيوصلك إشعار لما
                يأكد. الدفع بيتم بينك وبين التاجر — المنصة ما بتاخد شي.
              </div>
              <Link href="/account/orders" className="press flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
                تابع طلباتي
              </Link>
              <button type="button" onClick={onClose} className="h-11 w-full rounded-xl font-bold ring-1 ring-line">
                إغلاق
              </button>
            </div>
          ) : status === "loading" || status === "unknown" ? (
            <div className="h-28 animate-pulse rounded-xl bg-sand" aria-busy="true" />
          ) : !signedIn ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">
                سجّل دخولك لتبعت الطلب. منرسل للتاجر اسمك ورقمك من حسابك، وبتقدر تتابع طلباتك وتلغيها من صفحة
                «طلباتي».
              </p>
              <Link href={`/account/login?next=${encodeURIComponent(pathname)}`} className="press flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
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
            <form onSubmit={submit} className="space-y-4">
              {/* The lines, still editable here */}
              <ul className="divide-y divide-line rounded-xl bg-sand">
                {cart.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-3">
                    {i.image && <img src={i.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium">{i.title}</div>
                      <div className="text-xs text-muted">
                        {i.price === null || i.priceType !== "FIXED" ? "السعر عند الطلب" : money(i.price * i.quantity, i.currency)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => setQuantity(cart.store.slug, i.id, i.quantity - 1)} aria-label="إنقاص" className="h-8 w-8 rounded-lg bg-surface font-bold ring-1 ring-line">
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-bold">{formatNumber(i.quantity)}</span>
                      <button type="button" onClick={() => setQuantity(cart.store.slug, i.id, i.quantity + 1)} aria-label="زيادة" className="h-8 w-8 rounded-lg bg-surface font-bold ring-1 ring-line">
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                <span className="text-sm font-medium">إجمالي الطلب</span>
                <span className="text-lg font-bold">{total === null ? "يحدده التاجر" : money(total, currency)}</span>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">كيف بدك تستلم؟</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "DELIVERY" as const, label: "توصيل", hint: cart.store.hasDelivery ? "لعنوانك" : "غير متوفر بهالمتجر" },
                    { id: "PICKUP" as const, label: "استلام من المحل", hint: cart.store.governorate ?? "من المحل" },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={o.id === "DELIVERY" && !cart.store.hasDelivery}
                      onClick={() => setFulfillment(o.id)}
                      className={`rounded-xl p-3 text-start text-sm ring-1 transition disabled:opacity-40 ${fulfillment === o.id ? "bg-brand-50 font-bold ring-brand-500" : "ring-line"}`}
                    >
                      {o.label}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">{o.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {fulfillment === "DELIVERY" && (
                <>
                  <Field label="المحافظة">
                    <select className={inputClass} value={governorateId} onChange={(e) => setGovernorateId(e.target.value)} required>
                      <option value="">اختر المحافظة</option>
                      {governorates.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="العنوان" hint="المنطقة والشارع وأقرب علامة مميزة، ورقم الطابق إن وجد.">
                    <textarea
                      className={textareaClass}
                      rows={2}
                      required
                      maxLength={300}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="مثال: المزة، شارع الجلاء، بناء 12، الطابق الثالث"
                    />
                  </Field>
                </>
              )}

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">طريقة الدفع</legend>
                <div className="space-y-2">
                  {PAYMENTS[fulfillment].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPayment(p.id)}
                      className={`flex w-full items-start gap-2 rounded-xl p-3 text-start text-sm ring-1 transition ${payment === p.id ? "bg-brand-50 font-bold ring-brand-500" : "ring-line"}`}
                    >
                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-4 bg-surface ${payment === p.id ? "border-brand-600" : "border-line"}`} />
                      <span>
                        {p.label}
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">{p.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field label="ملاحظة للتاجر" optional>
                <textarea
                  className={textareaClass}
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: بدي ياه لون أسود، وأفضل التسليم بعد العصر"
                />
              </Field>

              <div className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">
                <div className="font-bold">{user.name}</div>
                <bdi dir="ltr" className="text-muted">{displayPhone(user.phone)}</bdi>
                <div className="mt-1 text-xs text-muted">
                  منرسل هالاسم والرقم للتاجر ليتواصل معك.{" "}
                  <Link href="/account/phone" className="font-medium text-brand-700">تغيير الرقم</Link>
                </div>
              </div>

              <FormError message={error} />
              <button type="submit" disabled={busy || !cart.items.length} className="press h-12 w-full rounded-xl bg-brand-600 font-bold text-white disabled:opacity-60">
                {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
              </button>
              <p className="text-center text-xs leading-5 text-muted">
                التاجر بيأكدلك السعر النهائي وأجرة التوصيل. الدفع بينك وبين التاجر، والمنصة ما بتاخد عمولة.
              </p>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
