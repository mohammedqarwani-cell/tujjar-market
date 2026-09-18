"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@lib/session";
import { useAuthData } from "@lib/merchant";
import { displayPhone, formatNumber, timeAgo } from "@lib/format";
import { whatsappLink } from "@lib/contact";
import { webUrl } from "@lib/urls";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { PhoneIcon, WhatsAppIcon } from "@components/ui/icons";

type Status = "NEW" | "CONTACTED" | "DONE" | "CANCELLED";

type Lead = {
  id: string;
  name: string;
  phone: string;
  quantity: number | null;
  note: string | null;
  status: Status;
  createdAt: string;
  handledAt: string | null;
  product: { id: string; title: string; images: string[] } | null;
};

type LeadsPage = { items: Lead[]; total: number; counts: Partial<Record<Status, number>> };

const TABS: { id: string; label: string }[] = [
  { id: "NEW", label: "جديدة" },
  { id: "CONTACTED", label: "تواصلت معهم" },
  { id: "DONE", label: "مكتملة" },
  { id: "CANCELLED", label: "ملغاة" },
  { id: "", label: "الكل" },
];

const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-brand-50 text-brand-700",
  CONTACTED: "bg-olive-50 text-olive-700",
  DONE: "bg-sand text-muted",
  CANCELLED: "bg-sand text-muted",
};
const STATUS_LABEL: Record<Status, string> = { NEW: "جديد", CONTACTED: "تواصلت", DONE: "مكتمل", CANCELLED: "ملغى" };

const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";

export default function OrdersPage() {
  const [tab, setTab] = useState("NEW");
  const { data, error, reload } = useAuthData<LeadsPage>(`/merchant/leads?pageSize=50${tab ? `&status=${tab}` : ""}`);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  const setStatus = async (id: string, status: Status) => {
    setBusy(id);
    setActionError("");
    try {
      await apiRequest(`/merchant/leads/${id}`, { audience: "merchant", method: "PATCH", body: { status } });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "تعذّر تحديث الطلب");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">طلبات الزبائن</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          كل زبون ضغط «اطلب من المتجر» بيوصلك هون باسمه ورقمه، وبتقدر تتابع حالته حتى ما يضيع بين رسائل الواتساب.
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
        <EmptyState icon="🛎" title={tab === "NEW" ? "ما في طلبات جديدة" : "لا توجد طلبات هنا"}>
          لما يضغط زبون «اطلب من المتجر» على صفحة منتجك، بيوصلك الطلب هون وبيجيك إشعار.
        </EmptyState>
      )}

      {data?.items.map((lead) => {
        const message = lead.product
          ? `مرحباً ${lead.name}، وصلنا طلبك على تُجّار ماركت بخصوص «${lead.product.title}».`
          : `مرحباً ${lead.name}، وصلنا طلبك على تُجّار ماركت.`;
        return (
          <article key={lead.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${busy === lead.id ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-start gap-3">
              {lead.product?.images[0] && (
                <img src={lead.product.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{lead.name}</b>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
                  <span className="text-xs text-muted">{timeAgo(lead.createdAt)}</span>
                </div>
                <div className="mt-1 text-sm">
                  {lead.product ? (
                    <Link href={webUrl(`/products/${lead.product.id}`)} target="_blank" className="font-medium hover:text-brand-700">
                      {lead.product.title}
                    </Link>
                  ) : (
                    <span className="text-muted">استفسار عن المتجر</span>
                  )}
                  {lead.quantity ? <span className="text-muted"> · الكمية: {formatNumber(lead.quantity)}</span> : null}
                </div>
                {lead.note && <p className="mt-2 whitespace-pre-line rounded-xl bg-sand px-3 py-2 text-sm leading-7">{lead.note}</p>}
                <div className="mt-2 text-sm">
                  <bdi dir="ltr" className="font-medium">{displayPhone(lead.phone)}</bdi>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={whatsappLink(lead.phone, message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => lead.status === "NEW" && setStatus(lead.id, "CONTACTED")}
                className="flex h-10 items-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold text-white"
              >
                <WhatsAppIcon size={18} /> رد على واتساب
              </a>
              <a href={`tel:+${lead.phone}`} className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ring-1 ring-line">
                <PhoneIcon size={18} /> اتصال
              </a>
              {lead.status !== "DONE" && (
                <button type="button" disabled={!!busy} onClick={() => setStatus(lead.id, "DONE")} className={`${chip} h-10 bg-olive-500 text-white ring-olive-500`}>
                  تم البيع
                </button>
              )}
              {lead.status !== "CANCELLED" && (
                <button type="button" disabled={!!busy} onClick={() => setStatus(lead.id, "CANCELLED")} className={`${chip} h-10 text-danger ring-danger/30`}>
                  إلغاء
                </button>
              )}
              {lead.status !== "NEW" && (
                <button type="button" disabled={!!busy} onClick={() => setStatus(lead.id, "NEW")} className={`${chip} h-10 ring-line`}>
                  رجّعه جديد
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
