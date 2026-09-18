"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@lib/session";
import { useAuthData } from "@lib/merchant";
import { displayPhone, formatNumber, priceLabel, timeAgo } from "@lib/format";
import { whatsappLink } from "@lib/contact";
import { webUrl } from "@lib/urls";
import type { Currency } from "@lib/types";
import { FormError, inputClass } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { PhoneIcon, WhatsAppIcon } from "@components/ui/icons";

type Status = "NEW" | "CONFIRMED" | "DONE" | "CANCELLED";

type Order = {
  id: string;
  ref: number;
  buyerName: string;
  buyerPhone: string;
  productTitle: string;
  quantity: number;
  unitPrice: number | null;
  currency: Currency;
  total: number | null;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string | null;
  payment: "CASH_ON_DELIVERY" | "CASH_AT_SHOP" | "TRANSFER";
  note: string | null;
  status: Status;
  deliveryFee: number | null;
  merchantNote: string | null;
  cancelReason: string | null;
  createdAt: string;
  governorate: { name: string } | null;
  product: { id: string; images: string[] } | null;
};

type OrdersPage = { items: Order[]; counts: Partial<Record<Status, number>> };

const TABS: { id: string; label: string }[] = [
  { id: "NEW", label: "جديدة" },
  { id: "CONFIRMED", label: "مؤكّدة" },
  { id: "DONE", label: "مسلّمة" },
  { id: "CANCELLED", label: "ملغاة" },
  { id: "", label: "الكل" },
];

const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-brand-50 text-brand-700",
  CONFIRMED: "bg-olive-50 text-olive-700",
  DONE: "bg-sand text-muted",
  CANCELLED: "bg-danger/10 text-danger",
};
const STATUS_LABEL: Record<Status, string> = { NEW: "بانتظار تأكيدك", CONFIRMED: "مؤكّد", DONE: "مسلّم", CANCELLED: "ملغى" };
const PAYMENT_LABEL: Record<Order["payment"], string> = {
  CASH_ON_DELIVERY: "نقداً عند الاستلام",
  CASH_AT_SHOP: "نقداً في المحل",
  TRANSFER: "حوالة أو تحويل",
};

const money = (value: number, currency: Currency) => priceLabel({ price: value, currency, priceType: "FIXED" }).main;
const chip = "h-10 rounded-xl px-4 text-sm font-bold ring-1 transition disabled:opacity-50";

export default function OrdersPage() {
  const [tab, setTab] = useState("NEW");
  const { data, error, reload } = useAuthData<OrdersPage>(`/merchant/orders?pageSize=50${tab ? `&status=${tab}` : ""}`);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");

  const update = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setActionError("");
    try {
      await apiRequest(`/merchant/orders/${id}`, { audience: "merchant", method: "PATCH", body });
      setConfirming(null);
      setFee("");
      setNote("");
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "تعذّر تحديث الطلب");
    } finally {
      setBusy("");
    }
  };

  const cancel = (id: string) => {
    const reason = window.prompt("سبب الإلغاء (يظهر للزبون):", "المنتج غير متوفر حالياً");
    if (reason === null) return;
    void update(id, { status: "CANCELLED", cancelReason: reason });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">الطلبات</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          كل طلب بيوصلك باسم الزبون ورقمه والكمية والعنوان وطريقة الدفع. أكّد الطلب وحدد أجرة التوصيل، والزبون
          بيوصله إشعار بردك.
        </p>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const count = t.id ? (data?.counts[t.id as Status] ?? 0) : undefined;
          return (
            <button
              key={t.id || "all"}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-ink text-canvas" : "bg-surface text-muted ring-1 ring-line"}`}
            >
              {t.label}
              {!!count && (
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === t.id ? "bg-canvas/20" : "bg-brand-50 text-brand-700"}`}>
                  {formatNumber(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <FormError message={error || actionError} />

      {data?.items.length === 0 && (
        <EmptyState icon="🛒" title={tab === "NEW" ? "ما في طلبات جديدة" : "لا توجد طلبات هنا"}>
          لما يضغط زبون «اطلب الآن» على منتج من متجرك، بيوصلك الطلب هون وبيجيك إشعار فوراً.
        </EmptyState>
      )}

      {data?.items.map((o) => (
        <article key={o.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${busy === o.id ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-start gap-3">
            {o.product?.images[0] && <img src={o.product.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                <span className="text-xs text-muted">طلب #{o.ref} · {timeAgo(o.createdAt)}</span>
              </div>
              <h2 className="mt-1 font-bold">
                {o.product ? (
                  <Link href={webUrl(`/products/${o.product.id}`)} target="_blank" className="hover:text-brand-700">{o.productTitle}</Link>
                ) : (
                  o.productTitle
                )}
              </h2>
              <p className="text-sm text-muted">
                {o.buyerName} · <bdi dir="ltr">{displayPhone(o.buyerPhone)}</bdi>
              </p>
            </div>
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted">الكمية:</dt>
              <dd className="font-medium">
                {formatNumber(o.quantity)}
                {o.unitPrice !== null && <span className="text-muted"> × {money(o.unitPrice, o.currency)}</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">الإجمالي:</dt>
              <dd className="font-medium">
                {o.total === null ? "السعر عند الطلب" : money(o.total, o.currency)}
                {o.deliveryFee ? <span className="text-muted"> + توصيل {money(o.deliveryFee, o.currency)}</span> : null}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">الاستلام:</dt>
              <dd className="font-medium">{o.fulfillment === "DELIVERY" ? `توصيل — ${o.governorate?.name ?? ""}` : "من المحل"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">الدفع:</dt>
              <dd className="font-medium">{PAYMENT_LABEL[o.payment]}</dd>
            </div>
            {o.address && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="shrink-0 text-muted">العنوان:</dt>
                <dd>{o.address}</dd>
              </div>
            )}
            {o.note && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="shrink-0 text-muted">ملاحظة الزبون:</dt>
                <dd className="whitespace-pre-line">{o.note}</dd>
              </div>
            )}
          </dl>

          {o.merchantNote && <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm leading-7">ردك: {o.merchantNote}</p>}
          {o.status === "CANCELLED" && o.cancelReason && (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm leading-7 text-danger">سبب الإلغاء: {o.cancelReason}</p>
          )}

          {confirming === o.id ? (
            <div className="mt-3 space-y-2 rounded-xl bg-sand p-3">
              {o.fulfillment === "DELIVERY" && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">أجرة التوصيل ({o.currency === "USD" ? "دولار" : "ل.س"})</span>
                  <input
                    className={inputClass}
                    value={fee}
                    onChange={(e) => setFee(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    inputMode="numeric"
                    placeholder="مثال: 15000"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-medium">رسالة للزبون</span>
                <input
                  className={inputClass}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="مثال: جاهز للتسليم بكرا قبل الظهر"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => update(o.id, { status: "CONFIRMED", deliveryFee: fee ? Number(fee) : undefined, merchantNote: note || undefined })}
                  className={`${chip} bg-olive-500 text-white ring-olive-500`}
                >
                  أكّد الطلب
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={`${chip} ring-line`}>
                  رجوع
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={whatsappLink(o.buyerPhone, `مرحباً ${o.buyerName}، بخصوص طلبك #${o.ref} «${o.productTitle}» من متجرنا.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold text-white"
              >
                <WhatsAppIcon size={18} /> واتساب
              </a>
              <a href={`tel:+${o.buyerPhone}`} className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ring-1 ring-line">
                <PhoneIcon size={18} /> اتصال
              </a>
              {o.status === "NEW" && (
                <button type="button" disabled={!!busy} onClick={() => setConfirming(o.id)} className={`${chip} bg-olive-500 text-white ring-olive-500`}>
                  أكّد الطلب
                </button>
              )}
              {(o.status === "NEW" || o.status === "CONFIRMED") && (
                <>
                  <button type="button" disabled={!!busy} onClick={() => update(o.id, { status: "DONE" })} className={`${chip} bg-ink text-canvas ring-ink`}>
                    تم التسليم
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => cancel(o.id)} className={`${chip} text-danger ring-danger/30`}>
                    إلغاء
                  </button>
                </>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
