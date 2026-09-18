"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatNumber } from "@lib/format";
import { useAuthData, type MerchantStats, type MerchantStore } from "@lib/merchant";
import { SITE_URL, whatsappLink } from "@lib/contact";
import { DailyBars } from "@components/merchant/DailyBars";
import { FormError } from "@components/forms/fields";
import { BoxIcon, EyeIcon, PhoneIcon, PlusIcon, ShareIcon, WhatsAppIcon } from "@components/ui/icons";

export default function DashboardPage() {
  return (
    <Suspense>
      <Overview />
    </Suspense>
  );
}

function Overview() {
  const welcome = useSearchParams().get("welcome") === "1";
  const [days, setDays] = useState(30);
  const { data: stats, error } = useAuthData<MerchantStats>(`/merchant/stats?days=${days}`);
  const { data: store } = useAuthData<MerchantStore>("/merchant/store");
  const { data: leads } = useAuthData<{ newLeads: number }>("/merchant/leads/pending");

  const storeUrl = store ? `${SITE_URL}/stores/${store.slug}` : "";
  const tiles = [
    { label: "زيارات", value: stats?.totals.views, Icon: EyeIcon },
    { label: "رسائل واتساب", value: stats?.totals.whatsapp, Icon: WhatsAppIcon },
    { label: "اتصالات", value: stats?.totals.calls, Icon: PhoneIcon },
    { label: "منتجات معروضة", value: stats?.products.active, Icon: BoxIcon },
  ];

  const checklist = store
    ? [
        {
          done: store.verificationLevel === "LOCATION" || store.verificationLevel === "PREMIUM",
          label: "وثّق متجرك لتحصل على شارة «محل موثّق» وظهور أعلى في البحث",
          href: "/dashboard/verification",
        },
        { done: !!store.logoUrl, label: "أضف شعار المتجر", href: "/dashboard/store" },
        { done: store._count.products >= 5, label: `أضف 5 منتجات على الأقل (${store._count.products}/5)`, href: "/dashboard/products/new" },
        { done: !!(store.tagline && store.openingHours), label: "اكتب جملة تعريفية وأوقات الدوام", href: "/dashboard/store" },
        { done: !!store.address, label: "حدد عنوان المحل", href: "/dashboard/store" },
      ]
    : [];
  const pending = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{welcome ? "مبروك! متجرك صار جاهز 🎉" : "نظرة عامة"}</h1>
          <p className="mt-1 text-sm text-muted">
            {store?.status === "SUSPENDED" ? "متجرك موقوف مؤقتاً من الإدارة. تواصل معنا لمعرفة السبب." : "هيك عم يتفاعل الزبائن مع متجرك."}
          </p>
        </div>
        <Link href="/dashboard/products/new" className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-white hover:bg-brand-700">
          <PlusIcon size={18} /> إضافة منتج
        </Link>
      </div>

      <FormError message={error} />

      {!!leads?.newLeads && (
        <Link
          href="/dashboard/orders"
          className="press flex items-center justify-between gap-3 rounded-card bg-brand-600 p-5 text-white shadow-card"
        >
          <span>
            <b className="block text-lg">عندك {formatNumber(leads.newLeads)} طلب جديد من زبائن</b>
            <span className="text-sm text-white/85">ردّ عليهم بسرعة — الزبون يلي بيستنى كتير بيروح لغيرك.</span>
          </span>
          <span className="shrink-0 text-2xl" aria-hidden>🛎</span>
        </Link>
      )}

      {pending.length > 0 && (
        <section className="rounded-card bg-brand-50 p-5 ring-1 ring-brand-100">
          <h2 className="font-bold text-brand-900">خطوات بتجيبلك زبائن أكثر</h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={`flex items-center gap-3 text-sm ${c.done ? "text-muted line-through" : "font-medium text-ink hover:text-brand-700"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${c.done ? "bg-olive-500 text-white" : "bg-surface ring-1 ring-brand-200"}`}>
                    {c.done ? "✓" : ""}
                  </span>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-bold">آخر {days} يوم</h2>
        <div className="flex gap-1 rounded-xl bg-sand p-1 text-xs font-medium">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 ${days === d ? "bg-surface shadow-sm" : "text-muted"}`}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-card bg-surface p-4 ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Icon size={16} /> {label}
            </div>
            <div className="mt-2 text-3xl font-bold">{value == null ? "—" : formatNumber(value)}</div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DailyBars title="الزيارات اليومية" unit="زيارة" color="#b86e14" data={stats.series.map((d) => ({ day: d.day, value: d.views }))} />
          <DailyBars
            title="تواصل الزبائن اليومي"
            unit="تواصل"
            color="#178a45"
            data={stats.series.map((d) => ({ day: d.day, value: d.whatsapp + d.calls }))}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {stats && stats.topProducts.length > 0 && (
          <section className="rounded-card bg-surface p-5 ring-1 ring-line">
            <h2 className="font-bold">المنتجات الأكثر طلباً</h2>
            <ol className="mt-3 divide-y divide-line">
              {stats.topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
                  <Link href={`/dashboard/products/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-700">{p.title}</Link>
                  <span className="flex items-center gap-1 text-muted"><EyeIcon size={14} />{formatNumber(p.viewsCount)}</span>
                  <span className="flex items-center gap-1 text-muted"><WhatsAppIcon size={14} />{formatNumber(p.contactsCount)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {store && (
          <section className="min-w-0 rounded-card bg-ink p-5 text-canvas">
            <h2 className="flex items-center gap-2 font-bold"><ShareIcon size={18} /> شارك رابط متجرك</h2>
            <p className="mt-2 text-sm leading-7 text-canvas/70">
              حطّه بحالة الواتساب، بصفحة الفيسبوك، وعلى كرت المحل. كل زيارة منه بتنحسب هون.
            </p>
            <div dir="ltr" className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-canvas/10 px-3 py-2 text-start text-sm" title={storeUrl}>
              {storeUrl.replace(/^https?:\/\//, "")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={storeUrl} />
              <a
                href={whatsappLink("", `تفضلوا زوروا متجرنا «${store.name}» على تُجّار ماركت وشوفوا كل منتجاتنا وأسعارنا:\n${storeUrl}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center gap-2 rounded-xl bg-wa px-4 text-sm font-bold text-white hover:bg-wa-dark"
              >
                <WhatsAppIcon size={18} /> شارك على واتساب
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="h-10 rounded-xl bg-canvas px-4 text-sm font-bold text-ink hover:bg-brand-100"
    >
      {copied ? "✓ تم النسخ" : "نسخ الرابط"}
    </button>
  );
}
