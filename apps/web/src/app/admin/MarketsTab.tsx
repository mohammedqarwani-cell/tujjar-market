"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toQuery } from "@lib/api";
import { webUrl } from "@lib/urls";
import { displayPhone, timeAgo } from "@lib/format";
import { adminFetch, apiRequest } from "@lib/session";
import type { GovernorateStatus, Page } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";

type AdminGovernorate = {
  id: string;
  slug: string;
  name: string;
  status: GovernorateStatus;
  storesCount: number;
  marketsCount: number;
  newInterests: number;
};

type AdminMarket = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  geofenceStatus: "DRAFT" | "CONFIRMED";
  storesCount: number;
};

type Interest = {
  id: string;
  name: string;
  phone: string;
  storeName: string | null;
  contactedAt: string | null;
  createdAt: string;
  category: { name: string; icon: string } | null;
};

type Suggestion = {
  samples: number;
  required: number;
  suggestion: { latitude: number; longitude: number; radiusMeters: number } | null;
};

const input = "h-10 rounded-xl border border-line bg-surface px-3 text-sm";
const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";
const message = (e: unknown, fallback = "تعذّر تنفيذ العملية") => (e instanceof Error ? e.message : fallback);
const send = (method: string, path: string, body?: unknown) => apiRequest(path, { audience: "admin", method, body });

/** Pilot rollout: which governorates are open, their markets and geofences, and merchants waiting to join. */
export function MarketsTab({ isAdmin }: { isAdmin: boolean }) {
  const [governorates, setGovernorates] = useState<AdminGovernorate[] | null>(null);
  const [selected, setSelected] = useState("damascus");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setGovernorates(await adminFetch<AdminGovernorate[]>("/admin/governorates"));
    } catch (e) {
      setError(message(e, "تعذّر التحميل"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const current = governorates?.find((g) => g.slug === selected);

  async function toggleStatus(g: AdminGovernorate) {
    const opening = g.status !== "ACTIVE";
    const question = opening
      ? `فتح التسجيل في ${g.name}؟ سيتمكن التجار من التسجيل وستظهر متاجرها للزبائن.`
      : `إرجاع ${g.name} إلى «قريباً»؟ ستختفي متاجرها (${g.storesCount}) عن الزبائن ويتوقف التسجيل فيها.`;
    if (!confirm(question)) return;
    setError("");
    try {
      await send("PATCH", `/admin/governorates/${g.id}/status`, { status: opening ? "ACTIVE" : "COMING_SOON" });
      await load();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-muted">
        المحافظات المفتوحة فقط تستقبل المتاجر وتظهر للزبائن. حدود السوق «المبدئية» ترشد المراجعين فقط، و«المؤكدة» ترفض تلقائياً
        فيديو المحل المصوَّر خارجها، فلا تؤكدها إلا بعد مراجعتها ميدانياً أو من المتاجر الموثّقة.
      </p>
      <FormError message={error} />

      <div className="flex flex-wrap gap-2">
        {governorates?.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelected(g.slug)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ${selected === g.slug ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line"}`}
          >
            <span className={`h-2 w-2 rounded-full ${g.status === "ACTIVE" ? "bg-olive-500" : "bg-line"}`} />
            {g.name}
            {g.newInterests > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{g.newInterests}</span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4 ring-1 ring-line">
            <div>
              <h2 className="text-lg font-bold">{current.name}</h2>
              <p className="text-sm text-muted">
                {current.status === "ACTIVE" ? "مفتوحة: تستقبل المتاجر وتظهر للزبائن" : "قريباً: تسجيل اهتمام التجار فقط"} ·{" "}
                {current.storesCount} متجر · {current.marketsCount} سوق
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => toggleStatus(current)}
                className={`${chip} ${current.status === "ACTIVE" ? "text-muted ring-line" : "bg-olive-500 text-white ring-olive-500"}`}
              >
                {current.status === "ACTIVE" ? "إرجاع إلى «قريباً»" : "فتح التسجيل"}
              </button>
            )}
          </section>
          <MarketsList key={current.slug} governorate={current} isAdmin={isAdmin} onChanged={load} />
          <InterestsList key={`interests-${current.slug}`} governorate={current} onChanged={load} />
        </>
      )}
    </div>
  );
}

function MarketsList({
  governorate,
  isAdmin,
  onChanged,
}: {
  governorate: AdminGovernorate;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [markets, setMarkets] = useState<AdminMarket[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  const load = async () => {
    try {
      setMarkets(await adminFetch<AdminMarket[]>(`/admin/markets${toQuery({ gov: governorate.slug })}`));
    } catch (e) {
      setError(message(e, "تعذّر التحميل"));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorate.slug]);

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      await load();
      onChanged();
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="font-bold">الأسواق</h3>
      {isAdmin && <NewMarketForm governorateId={governorate.id} onCreated={() => run(async () => {})} />}
      <FormError message={error} />
      {markets?.length === 0 && <EmptyState icon="🏪" title="لا توجد أسواق في هذه المحافظة" />}
      {markets?.map((m) => (
        <article key={m.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${m.isActive ? "" : "opacity-75"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{m.name}</span>
                <GeofenceChip market={m} />
                {!m.isActive && <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-muted">معطّل</span>}
              </div>
              <div className="mt-1 text-xs leading-6 text-muted">
                <bdi dir="ltr">{m.slug}</bdi> · {m.storesCount} متجر · الترتيب {m.sortOrder}
                {m.description ? ` · ${m.description}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {m.isActive && governorate.status === "ACTIVE" && (
                <Link href={webUrl(`/markets/${m.slug}`)} target="_blank" className={`${chip} ring-line`}>
                  عرض
                </Link>
              )}
              <button
                type="button"
                onClick={() => setOpenId(openId === m.id ? "" : m.id)}
                className={`${chip} ${openId === m.id ? "text-muted ring-line" : "bg-ink text-canvas ring-ink"}`}
              >
                {openId === m.id ? "إغلاق" : isAdmin ? "تعديل والحدود" : "الحدود"}
              </button>
            </div>
          </div>
          {openId === m.id && <MarketEditor market={m} isAdmin={isAdmin} run={run} onDeleted={() => setOpenId("")} />}
        </article>
      ))}
    </section>
  );
}

function GeofenceChip({ market: m }: { market: AdminMarket }) {
  if (m.latitude === null) {
    return <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-muted">بلا حدود</span>;
  }
  return m.geofenceStatus === "CONFIRMED" ? (
    <span className="rounded-full bg-olive-50 px-2 py-0.5 text-[11px] font-bold text-olive-700">حدود مؤكدة · {m.radiusMeters} م</span>
  ) : (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">حدود مبدئية · {m.radiusMeters} م</span>
  );
}

function NewMarketForm({ governorateId, onCreated }: { governorateId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await send("POST", "/admin/markets", { governorateId, name, description: description.trim() || undefined });
      setName("");
      setDescription("");
      onCreated();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2 rounded-card bg-sand/60 p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم السوق الجديد" maxLength={60} className={`${input} min-w-[10rem] flex-1`} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="وصف قصير (اختياري)"
        maxLength={200}
        className={`${input} min-w-[12rem] flex-[2]`}
      />
      <button type="submit" disabled={busy || name.trim().length < 2} className={`${chip} h-10 bg-brand-600 px-4 text-sm text-white ring-brand-600`}>
        إضافة سوق
      </button>
      {error && (
        <div className="w-full">
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}

function MarketEditor({
  market: m,
  isAdmin,
  run,
  onDeleted,
}: {
  market: AdminMarket;
  isAdmin: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
  onDeleted: () => void;
}) {
  const [details, setDetails] = useState({
    name: m.name,
    slug: m.slug,
    description: m.description ?? "",
    sortOrder: String(m.sortOrder),
  });
  const [fence, setFence] = useState({
    latitude: m.latitude?.toString() ?? "",
    longitude: m.longitude?.toString() ?? "",
    radiusMeters: m.radiusMeters?.toString() ?? "300",
  });
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const hasPoint = fence.latitude.trim() !== "" && fence.longitude.trim() !== "";

  const saveDetails = () =>
    run(() =>
      send("PATCH", `/admin/markets/${m.id}`, {
        name: details.name,
        slug: details.slug,
        description: details.description,
        sortOrder: Number(details.sortOrder) || 0,
      }),
    );

  const saveFence = (status: "DRAFT" | "CONFIRMED") => {
    if (
      status === "CONFIRMED" &&
      !confirm("بعد التأكيد يُرفض تلقائياً أي فيديو محل مصوَّر خارج هذه الحدود. هل راجعتها ميدانياً أو من المتاجر الموثّقة؟")
    ) {
      return;
    }
    run(() =>
      send("PATCH", `/admin/markets/${m.id}/geofence`, {
        latitude: Number(fence.latitude),
        longitude: Number(fence.longitude),
        radiusMeters: Math.round(Number(fence.radiusMeters)),
        status,
      }),
    );
  };

  function useMyLocation() {
    if (!navigator.geolocation) return setNote("المتصفح لا يدعم تحديد الموقع");
    setLocating(true);
    setNote("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFence((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }));
        setNote(`تم تحديد موقعك بدقة ±${Math.round(p.coords.accuracy)} م. قف في منتصف السوق للحصول على أفضل مركز.`);
        setLocating(false);
      },
      () => {
        setNote("تعذّر تحديد موقعك. اسمح للمتصفح بالوصول لموقعك وفعّل GPS");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function suggest() {
    setNote("");
    try {
      const s = await adminFetch<Suggestion>(`/admin/markets/${m.id}/geofence-suggestion`);
      if (!s.suggestion) {
        return setNote(`الاقتراح يحتاج ${s.required} متاجر موثّقة المحل على الأقل في هذا السوق (الموجود حالياً: ${s.samples}).`);
      }
      setFence({
        latitude: String(s.suggestion.latitude),
        longitude: String(s.suggestion.longitude),
        radiusMeters: String(s.suggestion.radiusMeters),
      });
      setNote(`اقتراح محسوب من مواقع ${s.samples} متاجر موثّقة. راجعه على الخريطة ثم احفظه.`);
    } catch (e) {
      setNote(message(e));
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-xs text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!isAdmin}
        className={`${input} mt-1 w-full text-ink`}
        {...props}
      />
    </label>
  );

  return (
    <div className="mt-4 grid gap-6 border-t border-line pt-4 lg:grid-cols-2">
      {isAdmin && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold">بيانات السوق</h4>
          {field("الاسم", details.name, (v) => setDetails((d) => ({ ...d, name: v })), { maxLength: 60 })}
          {field("الرابط المختصر (أحرف إنجليزية)", details.slug, (v) => setDetails((d) => ({ ...d, slug: v })), { dir: "ltr", maxLength: 48 })}
          {field("الوصف", details.description, (v) => setDetails((d) => ({ ...d, description: v })), { maxLength: 200 })}
          {field("الترتيب", details.sortOrder, (v) => setDetails((d) => ({ ...d, sortOrder: v })), { type: "number", min: 0, dir: "ltr" })}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={saveDetails} className={`${chip} bg-ink text-canvas ring-ink`}>
              حفظ البيانات
            </button>
            <button type="button" onClick={() => run(() => send("PATCH", `/admin/markets/${m.id}`, { isActive: !m.isActive }))} className={`${chip} ring-line`}>
              {m.isActive ? "تعطيل السوق" : "تفعيل السوق"}
            </button>
            {m.storesCount === 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`حذف «${m.name}» نهائياً؟`)) {
                    run(async () => {
                      await send("DELETE", `/admin/markets/${m.id}`);
                      onDeleted();
                    });
                  }
                }}
                className={`${chip} text-danger ring-danger/30`}
              >
                حذف
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-bold">حدود السوق الجغرافية</h4>
        <div className="grid grid-cols-3 gap-2">
          {field("خط العرض", fence.latitude, (v) => setFence((f) => ({ ...f, latitude: v })), { dir: "ltr", inputMode: "decimal" })}
          {field("خط الطول", fence.longitude, (v) => setFence((f) => ({ ...f, longitude: v })), { dir: "ltr", inputMode: "decimal" })}
          {field("نصف القطر (م)", fence.radiusMeters, (v) => setFence((f) => ({ ...f, radiusMeters: v })), { dir: "ltr", type: "number", min: 50, max: 3000 })}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useMyLocation} disabled={locating} className={`${chip} ring-line`}>
              {locating ? "جارِ تحديد الموقع…" : "📍 استخدم موقعي الحالي"}
            </button>
            <button type="button" onClick={suggest} className={`${chip} ring-line`}>
              اقتراح من المتاجر الموثّقة
            </button>
          </div>
        )}
        {hasPoint && (
          <a
            href={`https://www.google.com/maps?q=${fence.latitude},${fence.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-bold text-brand-700"
          >
            عرض المركز على الخريطة ←
          </a>
        )}
        {note && <p className="text-xs leading-6 text-muted">{note}</p>}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={!hasPoint} onClick={() => saveFence("DRAFT")} className={`${chip} bg-brand-600 text-white ring-brand-600`}>
              حفظ كحدود مبدئية
            </button>
            <button type="button" disabled={!hasPoint} onClick={() => saveFence("CONFIRMED")} className={`${chip} bg-olive-500 text-white ring-olive-500`}>
              تأكيد الحدود
            </button>
            {m.latitude !== null && (
              <button
                type="button"
                onClick={() => confirm("إزالة حدود هذا السوق؟") && run(() => send("DELETE", `/admin/markets/${m.id}/geofence`))}
                className={`${chip} text-danger ring-danger/30`}
              >
                إزالة الحدود
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InterestsList({ governorate, onChanged }: { governorate: AdminGovernorate; onChanged: () => void }) {
  const [status, setStatus] = useState("new");
  const [data, setData] = useState<Page<Interest> | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setData(await adminFetch<Page<Interest>>(`/admin/interests${toQuery({ gov: governorate.slug, status, pageSize: 100 })}`));
    } catch (e) {
      setError(message(e, "تعذّر التحميل"));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorate.slug, status]);

  // Open governorates rarely have waiting merchants; only show the list when there is something in it
  if (governorate.status === "ACTIVE" && status === "new" && !data?.total) return null;

  async function mark(item: Interest) {
    setError("");
    try {
      await send("PATCH", `/admin/interests/${item.id}`, { contacted: !item.contactedAt });
      await load();
      onChanged();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">تجار ينتظرون الافتتاح</h3>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="new">لم نتواصل معهم بعد</option>
          <option value="contacted">تم التواصل</option>
        </select>
      </div>
      <FormError message={error} />
      {data?.items.length === 0 && <p className="text-sm text-muted">لا توجد طلبات.</p>}
      {data?.items.map((item) => (
        <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-3 ring-1 ring-line">
          <div className="text-sm">
            <span className="font-bold">{item.name}</span>
            {item.storeName ? ` · ${item.storeName}` : ""}
            {item.category ? ` · ${item.category.icon} ${item.category.name}` : ""}
            <div className="text-xs text-muted">
              <a href={`tel:+${item.phone}`} dir="ltr" className="font-medium text-brand-700">
                {displayPhone(item.phone)}
              </a>{" "}
              · {timeAgo(item.createdAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => mark(item)}
            className={`${chip} ${item.contactedAt ? "text-muted ring-line" : "bg-olive-500 text-white ring-olive-500"}`}
          >
            {item.contactedAt ? "إلغاء «تم التواصل»" : "تم التواصل"}
          </button>
        </article>
      ))}
    </section>
  );
}
