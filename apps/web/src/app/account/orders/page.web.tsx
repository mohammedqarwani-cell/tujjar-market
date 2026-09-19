"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, useSession } from "@lib/session";
import { formatNumber, priceLabel, timeAgo } from "@lib/format";
import { whatsappLink } from "@lib/contact";
import type { Currency } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { PhoneIcon, WhatsAppIcon } from "@components/ui/icons";

type Status = "NEW" | "CONFIRMED" | "DONE" | "CANCELLED";

type OrderItem = { id: string; title: string; image: string | null; unitPrice: number | null; quantity: number; lineTotal: number | null; product: { id: string } | null };

type Order = {
  id: string;
  ref: number;
  items: OrderItem[];
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
  store: { slug: string; name: string; whatsapp: string; phone: string | null };
};

export const STATUS_LABEL: Record<Status, string> = {
  NEW: "بانتظار تأكيد المتجر",
  CONFIRMED: "أكّده المتجر",
  DONE: "تم التسليم",
  CANCELLED: "ملغى",
};
const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-brand-50 text-brand-700",
  CONFIRMED: "bg-olive-50 text-olive-700",
  DONE: "bg-sand text-muted",
  CANCELLED: "bg-danger/10 text-danger",
};
export const PAYMENT_LABEL: Record<Order["payment"], string> = {
  CASH_ON_DELIVERY: "نقداً عند الاستلام",
  CASH_AT_SHOP: "نقداً في المحل",
  TRANSFER: "حوالة أو تحويل",
};

export const money = (value: number, currency: Currency) => priceLabel({ price: value, currency, priceType: "FIXED" }).main;

export default function MyOrdersPage() {
  const { status: session } = useSession("web");
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await apiRequest<{ items: Order[] }>("/orders/mine?pageSize=50", { audience: "web" });
      setOrders(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل طلباتك");
    }
  }, []);

  useEffect(() => {
    if (session === "anonymous") router.replace("/account/login?next=/account/orders");
    if (session === "authenticated") void load();
  }, [session, router, load]);

  const cancel = async (id: string) => {
    if (!window.confirm("إلغاء هذا الطلب؟")) return;
    setBusy(id);
    setError("");
    try {
      await apiRequest(`/orders/${id}/cancel`, { audience: "web", method: "PATCH", body: {} });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إلغاء الطلب");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">طلباتي</h1>
        <p className="mt-1 text-sm leading-7 text-muted">تابع طلباتك وردود المتاجر. الدفع بينك وبين التاجر مباشرة.</p>
      </div>

      <FormError message={error} />

      {orders?.length === 0 && (
        <EmptyState icon="🛒" title="ما عندك طلبات بعد">
          لما تلاقي منتج عاجبك، اضغط «اطلب الآن» وحدد الكمية والعنوان، وبيوصل طلبك للمتجر فوراً.
        </EmptyState>
      )}

      {orders?.map((o) => (
        <article key={o.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${busy === o.id ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            <span className="text-xs text-muted">طلب #{o.ref} · {timeAgo(o.createdAt)}</span>
            <Link href={`/stores/${o.store.slug}`} className="text-sm font-medium hover:text-brand-700">{o.store.name}</Link>
          </div>

          <ul className="mt-3 divide-y divide-line rounded-xl bg-sand">
            {o.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                {item.image && <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium">
                    {item.product ? <Link href={`/products/${item.product.id}`} className="hover:text-brand-700">{item.title}</Link> : item.title}
                  </div>
                  <div className="text-xs text-muted">
                    {formatNumber(item.quantity)}
                    {item.unitPrice !== null ? ` × ${money(item.unitPrice, o.currency)}` : " قطعة"}
                  </div>
                </div>
                {item.lineTotal !== null && <div className="shrink-0 text-sm font-bold">{money(item.lineTotal, o.currency)}</div>}
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted">الإجمالي:</dt>
              <dd className="font-medium">
                {o.total === null ? "يحدده التاجر" : money(o.total, o.currency)}
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
                <dt className="shrink-0 text-muted">ملاحظتك:</dt>
                <dd>{o.note}</dd>
              </div>
            )}
          </dl>

          {o.merchantNote && (
            <p className="mt-3 rounded-xl bg-olive-50 px-3 py-2 text-sm leading-7 text-olive-700">رد المتجر: {o.merchantNote}</p>
          )}
          {o.status === "CANCELLED" && o.cancelReason && (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm leading-7 text-danger">سبب الإلغاء: {o.cancelReason}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={whatsappLink(o.store.whatsapp, `مرحباً ${o.store.name}، بخصوص طلبي رقم #${o.ref}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold text-white"
            >
              <WhatsAppIcon size={18} /> راسل المتجر
            </a>
            <a href={`tel:+${o.store.phone ?? o.store.whatsapp}`} className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ring-1 ring-line">
              <PhoneIcon size={18} /> اتصال
            </a>
            {(o.status === "NEW" || o.status === "CONFIRMED") && (
              <button type="button" disabled={!!busy} onClick={() => cancel(o.id)} className="h-10 rounded-xl px-4 text-sm font-bold text-danger ring-1 ring-danger/30 disabled:opacity-50">
                إلغاء الطلب
              </button>
            )}
            {o.status === "DONE" && (
              <Link href={`/stores/${o.store.slug}#reviews`} className="flex h-10 items-center rounded-xl px-4 text-sm font-bold ring-1 ring-line">
                قيّم المتجر
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
