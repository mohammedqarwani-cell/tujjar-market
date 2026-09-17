"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@lib/session";
import { formatNumber } from "@lib/format";
import { DailyBars } from "@components/merchant/DailyBars";

type Stats = {
  days: number;
  dayList: string[];
  totals: {
    users: Record<string, number>;
    storesByLevel: Record<string, number>;
    productsByStatus: Record<string, number>;
    reviews: number;
    openReports: number;
    pushDevices: number;
    follows: number;
    favorites: number;
  };
  series: { newUsers: number[]; newStores: number[]; newProducts: number[]; views: number[]; contacts: number[] };
  period: { newUsers: number; newStores: number; newProducts: number; views: number; whatsapp: number; calls: number };
  topStores: { slug?: string; name?: string; views: number; contacts: number }[];
  byGovernorate: { name: string; stores: number }[];
  byCategory: { name: string; icon: string; products: number }[];
};

const LEVELS: Record<string, string> = { REGISTERED: "مسجّل", IDENTITY: "هوية موثّقة", LOCATION: "محل موثّق", PREMIUM: "مميز" };

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-card bg-surface p-4 ring-1 ring-line">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{formatNumber(value)}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="rounded-card bg-surface p-5 ring-1 ring-line">
      <figcaption className="mb-3 font-bold">{title}</figcaption>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-sand">
              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="text-end font-medium">{formatNumber(r.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function StatsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    adminFetch<Stats>(`/admin/stats?days=${days}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [days]);

  if (error) return <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>;
  if (!data) return <div className="h-96 animate-pulse rounded-card bg-surface ring-1 ring-line" />;

  const series = (values: number[]) => data.dayList.map((day, i) => ({ day, value: values[i] }));
  const t = data.totals;
  const buyers = t.users.BUYER ?? 0;
  const merchants = t.users.MERCHANT ?? 0;
  const stores = Object.values(t.storesByLevel).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">نشاط المنصة</h2>
        <div className="flex gap-1 rounded-xl bg-sand p-1 text-sm font-medium">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 ${days === d ? "bg-surface shadow-sm" : "text-muted"}`}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="الزبائن" value={buyers} sub={`+${formatNumber(data.period.newUsers)} مستخدم جديد خلال الفترة`} />
        <Tile label="المتاجر الفعّالة" value={stores} sub={`${merchants} تاجر · +${formatNumber(data.period.newStores)} جديد`} />
        <Tile label="المنتجات المنشورة" value={t.productsByStatus.ACTIVE ?? 0} sub={`${t.productsByStatus.UNDER_REVIEW ?? 0} قيد المراجعة`} />
        <Tile label="التواصل مع التجار" value={data.period.whatsapp + data.period.calls} sub={`${formatNumber(data.period.whatsapp)} واتساب · ${formatNumber(data.period.calls)} اتصال`} />
        <Tile label="زيارات المتاجر" value={data.period.views} sub="خلال الفترة" />
        <Tile label="التقييمات المنشورة" value={t.reviews} sub={`${t.openReports} بلاغ مفتوح`} />
        <Tile label="المتابعات والمفضلة" value={t.follows + t.favorites} sub={`${formatNumber(t.follows)} متابعة · ${formatNumber(t.favorites)} مفضلة`} />
        <Tile label="أجهزة الإشعارات" value={t.pushDevices} sub="اشتراكات Web Push" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyBars title="زيارات المتاجر" unit="زيارة" color="#b86e14" data={series(data.series.views)} />
        <DailyBars title="التواصل (واتساب واتصال)" unit="تواصل" color="#178a45" data={series(data.series.contacts)} />
        <DailyBars title="مستخدمون جدد" unit="مستخدم" color="#56632a" data={series(data.series.newUsers)} />
        <DailyBars title="منتجات جديدة" unit="منتج" color="#8f5410" data={series(data.series.newProducts)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bars title="المتاجر حسب التوثيق" rows={Object.entries(LEVELS).map(([k, v]) => ({ label: v, value: t.storesByLevel[k] ?? 0 }))} />
        <Bars title="المتاجر حسب المحافظة" rows={data.byGovernorate.map((g) => ({ label: g.name, value: g.stores }))} />
        <Bars title="أكبر الأقسام" rows={data.byCategory.map((c) => ({ label: `${c.icon} ${c.name}`, value: c.products }))} />
      </div>

      <figure className="rounded-card bg-surface p-5 ring-1 ring-line">
        <figcaption className="mb-3 font-bold">الأكثر تواصلاً خلال الفترة</figcaption>
        {data.topStores.length ? (
          <ol className="space-y-2 text-sm">
            {data.topStores.map((s, i) => (
              <li key={s.slug ?? i} className="flex items-center justify-between gap-3">
                <span>
                  {i + 1}. {s.name ?? "—"}
                </span>
                <span className="text-muted">
                  {formatNumber(s.contacts)} تواصل · {formatNumber(s.views)} زيارة
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">لا يوجد نشاط مسجّل في هذه الفترة</p>
        )}
      </figure>
    </div>
  );
}
