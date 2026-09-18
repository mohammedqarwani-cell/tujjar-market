"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest, useSession } from "@lib/session";
import { apiGet } from "@lib/api";
import { displayPhone, formatNumber, priceLabel } from "@lib/format";
import { toast, haptic } from "@lib/toast";
import type { Currency, PriceType } from "@lib/types";
import { Portal } from "@components/ui/Portal";
import { Field, FormError, inputClass, textareaClass } from "@components/forms/fields";
import { XIcon } from "@components/ui/icons";

export type OrderProduct = {
  id: string;
  title: string;
  price: number | null;
  oldPrice?: number | null;
  currency: Currency;
  priceType: PriceType;
  inStock: boolean;
  image?: string | null;
};

type Props = {
  store: { slug: string; name: string; hasDelivery: boolean; governorate?: { name: string } };
  product: OrderProduct;
  variant?: "full" | "compact";
  className?: string;
};

type GovOption = { id: string; name: string };

/** Fetched once per visit, the first time someone opens an order form */
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

type Fulfillment = "DELIVERY" | "PICKUP";
type Payment = "CASH_ON_DELIVERY" | "CASH_AT_SHOP" | "TRANSFER";

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

/** A real purchase order: quantity, delivery or pickup, address and how it is paid. */
export function OrderButton({ store, product, variant = "full", className = "" }: Props) {
  const { status, user } = useSession("web", { lazy: true });
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ ref: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(store.hasDelivery ? "DELIVERY" : "PICKUP");
  const [payment, setPayment] = useState<Payment>(store.hasDelivery ? "CASH_ON_DELIVERY" : "CASH_AT_SHOP");
  const [governorateId, setGovernorateId] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [governorates, setGovernorates] = useState<GovOption[]>([]);

  // The address the buyer used last time, kept on this phone only
  useEffect(() => {
    if (!open) return;
    void loadGovernorates().then(setGovernorates);
    try {
      const saved = JSON.parse(localStorage.getItem(ADDRESS_KEY) ?? "{}");
      setAddress((a) => a || saved.address || "");
      setGovernorateId((g) => g || saved.governorateId || "");
    } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    // Keep the payment choice possible for the chosen way of getting the order
    if (!PAYMENTS[fulfillment].some((p) => p.id === payment)) setPayment(PAYMENTS[fulfillment][0].id);
  }, [fulfillment, payment]);

  const unitPrice = product.priceType === "FIXED" ? product.price : null;
  const total = unitPrice === null ? null : unitPrice * quantity;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await apiRequest<{ ref: number }>("/orders", {
        audience: "web",
        method: "POST",
        body: {
          productId: product.id,
          quantity,
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
      setDone(order);
      toast("وصل طلبك للمتجر", "🛒");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setDone(null);
    setNote("");
    setError("");
  };

  const signedIn = status === "authenticated" && user?.role === "BUYER";
  const priceLine = (value: number) => priceLabel({ price: value, currency: product.currency, priceType: "FIXED" }).main;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!product.inStock}
        className={
          variant === "compact"
            ? `press w-full rounded-xl bg-brand-600 py-2 text-xs font-bold text-white disabled:bg-sand disabled:text-muted ${className}`
            : `press flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-sand disabled:text-muted ${className}`
        }
      >
        {product.inStock ? "🛒 اطلب الآن" : "غير متوفر"}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`طلب ${product.title}`}
              onClick={(e) => e.stopPropagation()}
              className="animate-slide-up max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{done ? `وصل طلبك #${done.ref} ✓` : "تفاصيل الطلب"}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {product.title} — {store.name}
                  </p>
                </div>
                <button type="button" onClick={close} aria-label="إغلاق" className="shrink-0 rounded-lg p-1 text-muted hover:bg-sand">
                  <XIcon size={20} />
                </button>
              </div>

              {done ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-olive-50 px-4 py-3 text-sm leading-7 text-olive-700">
                    وصل طلبك للتاجر ووصله إشعار. رح يأكدلك السعر النهائي وأجرة التوصيل ووقت التسليم، وبيوصلك إشعار
                    لما يأكد. الدفع بيتم بينك وبين التاجر — المنصة ما بتاخد شي.
                  </div>
                  <Link href="/account/orders" className="press flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
                    تابع طلباتي
                  </Link>
                  <button type="button" onClick={close} className="h-11 w-full rounded-xl font-bold ring-1 ring-line">
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
                  {/* Quantity and price */}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-sand p-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted">الكمية</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          aria-label="إنقاص"
                          className="h-9 w-9 rounded-lg bg-surface text-lg font-bold ring-1 ring-line"
                        >
                          −
                        </button>
                        <input
                          value={quantity}
                          onChange={(e) => setQuantity(Math.min(9999, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                          inputMode="numeric"
                          aria-label="الكمية"
                          className="h-9 w-14 rounded-lg border border-line bg-surface text-center text-base"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(9999, q + 1))}
                          aria-label="زيادة"
                          className="h-9 w-9 rounded-lg bg-surface text-lg font-bold ring-1 ring-line"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs text-muted">{unitPrice === null ? "السعر" : "الإجمالي"}</div>
                      <div className="mt-1 text-lg font-bold">
                        {total === null ? "عند الطلب" : priceLine(total)}
                      </div>
                      {unitPrice !== null && quantity > 1 && (
                        <div className="text-[11px] text-muted">{formatNumber(quantity)} × {priceLine(unitPrice)}</div>
                      )}
                    </div>
                  </div>

                  {/* Delivery or pickup */}
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">كيف بدك تستلم؟</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: "DELIVERY" as const, label: "توصيل", hint: store.hasDelivery ? "لعنوانك" : "غير متوفر بهالمتجر" },
                        { id: "PICKUP" as const, label: "استلام من المحل", hint: store.governorate?.name ?? "من المحل" },
                      ]).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          disabled={o.id === "DELIVERY" && !store.hasDelivery}
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

                  {/* Payment */}
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
                          <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-4 ${payment === p.id ? "border-brand-600 bg-surface" : "border-line bg-surface"}`} />
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

                  {/* Who gets the order */}
                  <div className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">
                    <div className="font-bold">{user.name}</div>
                    <bdi dir="ltr" className="text-muted">{displayPhone(user.phone)}</bdi>
                    <div className="mt-1 text-xs text-muted">
                      منرسل هالاسم والرقم للتاجر ليتواصل معك.{" "}
                      <Link href="/account/phone" className="font-medium text-brand-700">تغيير الرقم</Link>
                    </div>
                  </div>

                  <FormError message={error} />
                  <button type="submit" disabled={busy} className="press h-12 w-full rounded-xl bg-brand-600 font-bold text-white disabled:opacity-60">
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
      )}
    </>
  );
}
