"use client";

import { useEffect, useRef, useState } from "react";
import { toQuery } from "@lib/api";
import { webUrl } from "@lib/urls";
import { formatNumber } from "@lib/format";
import { adminFetch } from "@lib/session";
import type { BannerTone, HomeSectionId, Page } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { PromoCarousel, TONES } from "@components/home/PromoCarousel";

type Banner = {
  id: string;
  eyebrow: string;
  title: string;
  cta: string;
  href: string;
  imageUrl: string | null;
  tone: BannerTone;
  governorateId: string | null;
  governorate: { name: string; slug: string } | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  isActive: boolean;
  clicks: number;
};

type Layout = {
  sections: { id: HomeSectionId; enabled: boolean; title: string }[];
  autoBanners: boolean;
  offers: { countdown: "midnight" | "until" | "none"; until: string | null };
  quickSearches: string[];
  greeting: boolean;
};

type StoreRef = { id: string; name: string; slug: string; status?: string; governorate: { name: string } };
type Gov = { id: string; name: string; status: string };

const SECTIONS: Record<HomeSectionId, { label: string; hint: string; fallback: string }> = {
  banners: { label: "البنرات", hint: "شريط العروض المتحرك", fallback: "بلا عنوان" },
  stories: { label: "حالات المحلات", hint: "دوائر الحالات التي ينشرها التجار وتختفي بعد يوم", fallback: "بلا عنوان" },
  posts: { label: "الجديد من المحلات", hint: "آخر منشورات وريلز التجار", fallback: "الجديد من المحلات" },
  showcase: { label: "بطاقات المتاجر", hint: "ثلاث بطاقات تتبدّل: المتاجر المميزة أولاً ثم بقية المتاجر (على الكمبيوتر تظهر دائماً بجانب العنوان)", fallback: "متاجر من أسواقك" },
  categories: { label: "الأقسام", hint: "أيقونات الأقسام", fallback: "تسوّق حسب القسم" },
  offers: { label: "عروض اليوم", hint: "منتجات عليها خصم مع عدّاد", fallback: "🔥 عروض اليوم" },
  openNow: { label: "مفتوح الآن", hint: "المتاجر المفتوحة حسب ساعات العمل", fallback: "مفتوح الآن" },
  featured: { label: "المختارات", hint: "المنتجات المميّزة", fallback: "مختارات من الأسواق" },
  markets: { label: "الأسواق", hint: "أسواق المحافظة", fallback: "أسواق المحافظة" },
  popular: { label: "الأكثر طلباً", hint: "منتجات يكثر التواصل مع أصحابها (غير المختارات)", fallback: "الأكثر طلباً في السوق" },
  howItWorks: { label: "كيف يعمل", hint: "ثلاث خطوات للزبون الجديد", fallback: "بلا عنوان" },
  recent: { label: "شاهدتها مؤخراً", hint: "تظهر فقط لمن تصفّح منتجات", fallback: "شاهدتها مؤخراً" },
  latest: { label: "وصل حديثاً", hint: "آخر المنتجات المضافة", fallback: "وصل حديثاً" },
};

const TONE_LABELS: Record<BannerTone, string> = { brand: "برتقالي", olive: "زيتوني", ink: "داكن", rose: "أحمر" };

const LINK_PRESETS = [
  { label: "كل العروض", href: "/search?offers=1" },
  { label: "المفتوح الآن", href: "/search?type=stores&open=1" },
  { label: "الأسواق", href: "/markets" },
  { label: "التوثيق", href: "/verification" },
];

const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
const card = "rounded-card bg-surface p-4 ring-1 ring-line sm:p-5";
const smallBtn = "rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ring-line hover:bg-sand disabled:opacity-40";

/** ISO → value for <input type="datetime-local"> in the admin's own time zone. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const dateLabel = (iso: string) => new Date(iso).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" });

function bannerState(b: Banner) {
  const now = Date.now();
  if (!b.isActive) return { label: "متوقف", cls: "bg-sand text-muted" };
  if (b.endsAt && new Date(b.endsAt).getTime() <= now) return { label: "انتهى", cls: "bg-sand text-muted" };
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return { label: "مجدول", cls: "bg-brand-50 text-brand-700" };
  return { label: "ظاهر الآن", cls: "bg-olive-50 text-olive-700" };
}

export function HomeTab() {
  const [view, setView] = useState<"banners" | "showcase" | "layout">("banners");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-sand p-1 text-sm font-medium">
          {[
            ["banners", "البنرات"],
            ["showcase", "المتاجر المميزة"],
            ["layout", "الأقسام والترتيب"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id as typeof view)}
              className={`rounded-lg px-4 py-2 ${view === id ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <a href={webUrl("/")} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700">
          افتح الصفحة الرئيسية ↗
        </a>
      </div>
      <p className="text-xs leading-6 text-muted">التعديلات تظهر للزبائن خلال دقيقة تقريباً. كل تغيير يُسجَّل في سجل التدقيق.</p>
      {view === "banners" ? <BannersPanel /> : view === "showcase" ? <ShowcasePanel /> : <LayoutPanel />}
    </div>
  );
}

/* ------------------------------------------------------------------ banners */

const EMPTY: Omit<Banner, "id" | "governorate" | "sortOrder" | "clicks"> = {
  eyebrow: "",
  title: "",
  cta: "تسوّق الآن",
  href: "/search?offers=1",
  imageUrl: null,
  tone: "brand",
  governorateId: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

function BannersPanel() {
  const [list, setList] = useState<Banner[] | null>(null);
  const [govs, setGovs] = useState<Gov[]>([]);
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    adminFetch<Banner[]>("/admin/home/banners")
      .then(setList)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
    adminFetch<Gov[]>("/governorates").then(setGovs).catch(() => undefined);
  }, []);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy("");
    }
  };

  const live = (list ?? []).filter((b) => bannerState(b).label === "ظاهر الآن");

  if (editing) {
    return (
      <BannerForm
        banner={editing === "new" ? null : editing}
        govs={govs}
        onDone={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">بنرات الصفحة الرئيسية</h3>
        <button type="button" onClick={() => setEditing("new")} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">
          + بنر جديد
        </button>
      </div>

      {live.length > 0 && (
        <div className={card}>
          <div className="mb-3 text-xs font-bold text-muted">معاينة ما يظهر الآن (بنرات الفريق فقط، لكل المحافظات)</div>
          <PromoCarousel preview promos={live.map((b) => ({ id: b.id, href: b.href, eyebrow: b.eyebrow, title: b.title, cta: b.cta, image: b.imageUrl, tone: b.tone }))} />
        </div>
      )}

      {list?.length === 0 && (
        <div className={`${card} text-center text-sm leading-7 text-muted`}>
          لا توجد بنرات بعد. الصفحة الرئيسية تعرض حالياً البنرات التلقائية (عدد العروض، المفتوح الآن، القسم الأكثر طلباً، التوثيق).
        </div>
      )}

      {list?.map((b, i) => {
        const state = bannerState(b);
        return (
          <article key={b.id} className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center ${busy === b.id ? "opacity-50" : ""}`}>
            <div className={`relative h-20 w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-l sm:w-36 ${TONES[b.tone]}`}>
              {b.imageUrl && <img src={b.imageUrl} alt="" className="absolute inset-y-0 end-0 h-full w-1/2 object-cover" />}
              <span className="relative block max-w-[60%] p-2 text-[11px] font-bold leading-4 text-white">{b.title}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <b className="truncate">{b.title}</b>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span>📍 {b.governorate?.name ?? "كل المحافظات"}</span>
                <bdi dir="ltr">{b.href}</bdi>
                {b.startsAt && <span>من {dateLabel(b.startsAt)}</span>}
                {b.endsAt && <span>حتى {dateLabel(b.endsAt)}</span>}
                <span>👆 {formatNumber(b.clicks)} نقرة</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={smallBtn} disabled={i === 0 || !!busy} onClick={() => act(b.id, () => adminFetch(`/admin/home/banners/${b.id}/move`, { method: "POST", body: { direction: -1 } }))} aria-label="تقديم">
                ↑
              </button>
              <button type="button" className={smallBtn} disabled={i === list.length - 1 || !!busy} onClick={() => act(b.id, () => adminFetch(`/admin/home/banners/${b.id}/move`, { method: "POST", body: { direction: 1 } }))} aria-label="تأخير">
                ↓
              </button>
              <button
                type="button"
                className={smallBtn}
                disabled={!!busy}
                onClick={() =>
                  act(b.id, () =>
                    adminFetch(`/admin/home/banners/${b.id}`, {
                      method: "PATCH",
                      body: { eyebrow: b.eyebrow, title: b.title, cta: b.cta, href: b.href, imageUrl: b.imageUrl, tone: b.tone, governorateId: b.governorateId, startsAt: b.startsAt, endsAt: b.endsAt, isActive: !b.isActive },
                    }),
                  )
                }
              >
                {b.isActive ? "إيقاف" : "تفعيل"}
              </button>
              <button type="button" className={smallBtn} disabled={!!busy} onClick={() => setEditing(b)}>
                تعديل
              </button>
              <button
                type="button"
                className={`${smallBtn} text-danger`}
                disabled={!!busy}
                onClick={() => window.confirm(`حذف البنر «${b.title}»؟`) && act(b.id, () => adminFetch(`/admin/home/banners/${b.id}`, { method: "DELETE" }))}
              >
                حذف
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BannerForm({ banner, govs, onDone }: { banner: Banner | null; govs: Gov[]; onDone: () => void }) {
  const [form, setForm] = useState(() => (banner ? { ...EMPTY, ...banner } : EMPTY));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const upload = async (f: File) => {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", f);
      const { url } = await adminFetch<{ url: string }>("/admin/media", { method: "POST", body });
      set("imageUrl", url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        eyebrow: form.eyebrow,
        title: form.title,
        cta: form.cta,
        href: form.href,
        imageUrl: form.imageUrl,
        tone: form.tone,
        governorateId: form.governorateId,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        isActive: form.isActive,
      };
      if (banner) await adminFetch(`/admin/home/banners/${banner.id}`, { method: "PATCH", body });
      else await adminFetch("/admin/home/banners", { method: "POST", body });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
      <div className={`${card} space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{banner ? "تعديل البنر" : "بنر جديد"}</h3>
          <button type="button" onClick={onDone} className="text-sm text-muted">
            رجوع
          </button>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">السطر العلوي الصغير</span>
          <input className={input} value={form.eyebrow} maxLength={40} onChange={(e) => set("eyebrow", e.target.value)} placeholder="مثال: لنهاية الأسبوع" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">العنوان</span>
          <input className={input} value={form.title} maxLength={70} onChange={(e) => set("title", e.target.value)} placeholder="مثال: خصومات حتى 30% على الألواح الشمسية" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">نص الزر</span>
            <input className={input} value={form.cta} maxLength={24} onChange={(e) => set("cta", e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">اللون</span>
            <div className="flex gap-2">
              {(Object.keys(TONES) as BannerTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  title={TONE_LABELS[t]}
                  aria-label={TONE_LABELS[t]}
                  onClick={() => set("tone", t)}
                  className={`h-10 flex-1 rounded-xl bg-gradient-to-l ${TONES[t]} ${form.tone === t ? "ring-4 ring-brand-200 ring-offset-2" : ""}`}
                />
              ))}
            </div>
          </label>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">يفتح صفحة</span>
          <input className={input} dir="ltr" value={form.href} onChange={(e) => set("href", e.target.value)} placeholder="/categories/solar" />
          <span className="flex flex-wrap gap-1.5">
            {LINK_PRESETS.map((p) => (
              <button key={p.href} type="button" onClick={() => set("href", p.href)} className="rounded-full bg-sand px-2.5 py-1 text-xs">
                {p.label}
              </button>
            ))}
          </span>
          <span className="block text-xs leading-5 text-muted">انسخ الجزء بعد اسم الموقع من أي صفحة: قسم، متجر، سوق، منتج أو نتيجة بحث.</span>
        </label>
        <div className="space-y-1.5 text-sm">
          <span className="font-medium">الصورة (اختيارية)</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="rounded-xl px-3 py-2 text-sm font-bold ring-1 ring-line">
              {uploading ? "جارٍ الرفع…" : form.imageUrl ? "تغيير الصورة" : "رفع صورة"}
            </button>
            {form.imageUrl && (
              <button type="button" onClick={() => set("imageUrl", null)} className="text-xs text-danger">
                إزالة الصورة
              </button>
            )}
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">يظهر في</span>
          <select className={input} value={form.governorateId ?? ""} onChange={(e) => set("governorateId", e.target.value || null)}>
            <option value="">كل المحافظات</option>
            {govs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.status !== "ACTIVE" ? " (قريباً)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">يبدأ الظهور</span>
            <input type="datetime-local" className={input} value={toLocal(form.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} />
            <span className="block text-xs text-muted">فارغ = فوراً</span>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">يختفي في</span>
            <input type="datetime-local" className={input} value={toLocal(form.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} />
            <span className="block text-xs text-muted">فارغ = بلا نهاية</span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-brand-600" />
          مفعّل
        </label>
        <FormError message={error} />
        <button type="button" onClick={save} disabled={saving || uploading} className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? "جارٍ الحفظ…" : banner ? "حفظ التعديلات" : "إضافة البنر"}
        </button>
      </div>

      <div className={`${card} h-fit space-y-3 lg:sticky lg:top-4`}>
        <div className="text-xs font-bold text-muted">معاينة كما يراها الزبون</div>
        <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] bg-canvas px-4 py-5 ring-8 ring-ink/90">
          <PromoCarousel preview promos={[{ href: form.href, eyebrow: form.eyebrow || "السطر العلوي", title: form.title || "عنوان البنر", cta: form.cta || "الزر", image: form.imageUrl, tone: form.tone }]} />
        </div>
        <p className="text-xs leading-6 text-muted">أفضل صورة: منتج واضح على خلفية بسيطة، عرض 800 بكسل على الأقل. تُضغط الصورة وتُزال بياناتها المخفية تلقائياً.</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- showcase */

type Promotion = {
  id: string;
  storeId: string;
  plan: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  clicks: number;
  store: { id: string; name: string; slug: string; logoUrl: string | null; status: string; governorate: { name: string; status: string } };
};

function promotionState(p: Promotion) {
  if (p.store.status !== "ACTIVE" || p.store.governorate.status !== "ACTIVE") return { label: "المتجر غير ظاهر للزبائن", cls: "bg-danger/10 text-danger" };
  return bannerState({ isActive: p.isActive, startsAt: p.startsAt, endsAt: p.endsAt } as Banner);
}

const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const inDays = (days: number, from?: string | null) => new Date(new Date(from ?? Date.now()).getTime() + days * 86_400_000).toISOString();

function StorePicker({ onPick, exclude = [] }: { onPick: (s: StoreRef) => void; exclude?: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreRef[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(() => {
      adminFetch<Page<StoreRef>>(`/admin/stores${toQuery({ q: query.trim(), pageSize: 8 })}`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  return (
    <div className="relative">
      <input className={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن متجر…" />
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl bg-surface shadow-xl ring-1 ring-line">
          {results.map((s) => {
            const taken = exclude.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    onPick(s);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-sand disabled:opacity-40"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted">{taken ? "مضاف" : s.governorate.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PLANS = ["باقة الواجهة", "باقة الواجهة الشهرية", "شريك إطلاق"];

function ShowcasePanel() {
  const [list, setList] = useState<Promotion[] | null>(null);
  const [store, setStore] = useState<StoreRef | null>(null);
  const [plan, setPlan] = useState(PLANS[0]);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(() => inDays(30));
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    adminFetch<Promotion[]>("/admin/home/promotions")
      .then(setList)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التنفيذ");
      return false;
    } finally {
      setBusy("");
    }
  };

  const reset = () => {
    setEditing(null);
    setStore(null);
    setPlan(PLANS[0]);
    setStartsAt(null);
    setEndsAt(inDays(30));
  };

  const submit = async () => {
    if (!store) return setError("اختر المتجر");
    const body = { storeId: store.id, plan, startsAt, endsAt };
    const ok = await act("form", () =>
      editing ? adminFetch(`/admin/home/promotions/${editing}`, { method: "PATCH", body }) : adminFetch("/admin/home/promotions", { method: "POST", body }),
    );
    if (ok) reset();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
      <section className={`${card} h-fit space-y-3`}>
        <h3 className="font-bold">{editing ? "تعديل الاشتراك" : "إضافة متجر مميز"}</h3>
        <p className="text-xs leading-6 text-muted">
          المتاجر المشتركة بباقة الظهور تُعرض باسمها أعلى الصفحة الرئيسية: ثلاث بطاقات تتقلّب معاً كل بضع ثوانٍ مع إشارة «متاجر مُموَّلة». يظهر المتجر لزبائن محافظته ولمن يتصفّح كل المحافظات، ويختفي تلقائياً عند انتهاء الباقة.
        </p>
        {store ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-sand px-3 py-2 text-sm">
            <span className="truncate font-bold">{store.name}</span>
            {!editing && (
              <button type="button" onClick={() => setStore(null)} className="text-xs text-muted">
                تغيير
              </button>
            )}
          </div>
        ) : (
          <StorePicker onPick={setStore} />
        )}
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">الباقة</span>
          <input className={input} list="tj-plans" value={plan} maxLength={40} onChange={(e) => setPlan(e.target.value)} />
          <datalist id="tj-plans">
            {PLANS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">من</span>
            <input type="datetime-local" className={input} value={toLocal(startsAt)} onChange={(e) => setStartsAt(fromLocal(e.target.value))} />
            <span className="block text-xs text-muted">فارغ = فوراً</span>
          </label>
          <div className="space-y-1.5 text-sm">
            <label className="block space-y-1.5">
              <span className="font-medium">حتى</span>
              <input type="datetime-local" className={input} value={toLocal(endsAt)} onChange={(e) => setEndsAt(fromLocal(e.target.value))} />
            </label>
            <span className="flex flex-wrap gap-1">
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => setEndsAt(inDays(d, startsAt))} className="rounded-full bg-sand px-2 py-0.5 text-[11px]">
                  {d} يوم
                </button>
              ))}
            </span>
          </div>
        </div>
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={busy === "form"} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {editing ? "حفظ" : "إضافة"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="rounded-xl px-4 text-sm ring-1 ring-line">
              إلغاء
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {list?.length === 0 && (
          <div className={`${card} text-center text-sm leading-7 text-muted`}>لا توجد متاجر مميزة بعد. حتى تضيف متاجر، تعرض الواجهة صوراً من منتجات الأسواق.</div>
        )}
        {list?.map((p, i) => {
          const state = promotionState(p);
          const left = daysLeft(p.endsAt);
          return (
            <article key={p.id} className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center ${busy === p.id ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={webUrl(`/stores/${p.store.slug}`)} target="_blank" rel="noreferrer" className="truncate font-bold hover:text-brand-700">
                    {p.store.name}
                  </a>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span>🏷 {p.plan}</span>
                  <span>📍 {p.store.governorate.name}</span>
                  {p.endsAt && (
                    <span className={left !== null && left > 0 && left <= 3 ? "font-bold text-danger" : ""}>
                      ينتهي {dateLabel(p.endsAt)}
                      {left !== null && left > 0 ? ` (${left} يوم)` : ""}
                    </span>
                  )}
                  <span>👆 {formatNumber(p.clicks)} زيارة</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={smallBtn} disabled={i === 0 || !!busy} onClick={() => act(p.id, () => adminFetch(`/admin/home/promotions/${p.id}/move`, { method: "POST", body: { direction: -1 } }))} aria-label="تقديم">
                  ↑
                </button>
                <button type="button" className={smallBtn} disabled={i === list.length - 1 || !!busy} onClick={() => act(p.id, () => adminFetch(`/admin/home/promotions/${p.id}/move`, { method: "POST", body: { direction: 1 } }))} aria-label="تأخير">
                  ↓
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={!!busy}
                  onClick={() =>
                    act(p.id, () => adminFetch(`/admin/home/promotions/${p.id}`, { method: "PATCH", body: { storeId: p.storeId, plan: p.plan, startsAt: p.startsAt, endsAt: p.endsAt, isActive: !p.isActive } }))
                  }
                >
                  {p.isActive ? "إيقاف" : "تفعيل"}
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={!!busy}
                  onClick={() => {
                    setEditing(p.id);
                    setStore({ id: p.store.id, name: p.store.name, slug: p.store.slug, governorate: p.store.governorate });
                    setPlan(p.plan);
                    setStartsAt(p.startsAt);
                    setEndsAt(p.endsAt);
                  }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  className={`${smallBtn} text-danger`}
                  disabled={!!busy}
                  onClick={() => window.confirm(`إزالة «${p.store.name}» من المتاجر المميزة؟`) && act(p.id, () => adminFetch(`/admin/home/promotions/${p.id}`, { method: "DELETE" }))}
                >
                  إزالة
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- layout */

function LayoutPanel() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newSearch, setNewSearch] = useState("");

  useEffect(() => {
    adminFetch<{ layout: Layout }>("/admin/home/layout")
      .then((r) => setLayout(r.layout))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!layout) return <FormError message={error} />;

  const update = (patch: Partial<Layout>) => {
    setLayout({ ...layout, ...patch });
    setDirty(true);
    setSaved("");
  };
  const setSection = (i: number, patch: Partial<Layout["sections"][number]>) =>
    update({ sections: layout.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveSection = (i: number, dir: number) => {
    const next = [...layout.sections];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    update({ sections: next });
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const next = await adminFetch<Layout>("/admin/home/layout", { method: "PUT", body: layout });
      setLayout(next);
      setDirty(false);
      setSaved("حُفظت التعديلات ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <section className={card}>
          <h3 className="font-bold">ترتيب الأقسام</h3>
          <p className="mt-1 text-xs leading-6 text-muted">رتّب أقسام الصفحة الرئيسية، أخفِ ما لا تريده، أو غيّر العنوان (اتركه فارغاً للعنوان الافتراضي).</p>
          <ol className="mt-3 space-y-2">
            {layout.sections.map((s, i) => {
              const meta = SECTIONS[s.id];
              return (
                <li key={s.id} className={`flex items-center gap-2 rounded-xl p-2 ring-1 ring-line ${s.enabled ? "" : "bg-sand/60 opacity-70"}`}>
                  <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
                  <input type="checkbox" checked={s.enabled} onChange={(e) => setSection(i, { enabled: e.target.checked })} className="h-4 w-4 shrink-0 accent-brand-600" aria-label={`إظهار ${meta.label}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{meta.label}</div>
                    <input
                      value={s.title}
                      maxLength={60}
                      onChange={(e) => setSection(i, { title: e.target.value })}
                      placeholder={meta.fallback}
                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-brand-500"
                      aria-label={`عنوان ${meta.label}`}
                    />
                    <div className="mt-0.5 text-[11px] text-muted">{meta.hint}</div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" className={smallBtn} disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label="للأعلى">
                      ↑
                    </button>
                    <button type="button" className={smallBtn} disabled={i === layout.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label="للأسفل">
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-4">
          <section className={`${card} space-y-3`}>
            <h3 className="font-bold">عام</h3>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={layout.greeting} onChange={(e) => update({ greeting: e.target.checked })} className="mt-1 h-4 w-4 accent-brand-600" />
              <span>
                تحية الزبون على الموبايل
                <span className="block text-xs text-muted">«صباح الخير، …» مع سؤال عمّا يبحث عنه</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={layout.autoBanners} onChange={(e) => update({ autoBanners: e.target.checked })} className="mt-1 h-4 w-4 accent-brand-600" />
              <span>
                البنرات التلقائية بعد بنرات الفريق
                <span className="block text-xs text-muted">عدد العروض، المفتوح الآن، القسم الأكثر طلباً، التوثيق</span>
              </span>
            </label>
          </section>

          <section className={`${card} space-y-3`}>
            <h3 className="font-bold">عدّاد عروض اليوم</h3>
            <select
              className={input}
              value={layout.offers.countdown}
              onChange={(e) => update({ offers: { ...layout.offers, countdown: e.target.value as Layout["offers"]["countdown"] } })}
            >
              <option value="midnight">حتى منتصف الليل (يتجدد يومياً)</option>
              <option value="until">حتى موعد محدد (حملة)</option>
              <option value="none">بلا عدّاد</option>
            </select>
            {layout.offers.countdown === "until" && (
              <input
                type="datetime-local"
                className={input}
                value={toLocal(layout.offers.until)}
                onChange={(e) => update({ offers: { ...layout.offers, until: fromLocal(e.target.value) } })}
              />
            )}
          </section>

          <section className={`${card} space-y-3`}>
            <h3 className="font-bold">«الأكثر بحثاً» تحت مربع البحث</h3>
            <div className="flex flex-wrap gap-1.5">
              {layout.quickSearches.map((q) => (
                <span key={q} className="inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-sm">
                  {q}
                  <button type="button" onClick={() => update({ quickSearches: layout.quickSearches.filter((x) => x !== q) })} className="text-muted" aria-label={`إزالة ${q}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = newSearch.trim();
                if (v && !layout.quickSearches.includes(v) && layout.quickSearches.length < 10) update({ quickSearches: [...layout.quickSearches, v] });
                setNewSearch("");
              }}
            >
              <input className={input} value={newSearch} maxLength={30} onChange={(e) => setNewSearch(e.target.value)} placeholder="كلمة بحث (حتى 10)" />
              <button type="submit" className="shrink-0 rounded-xl px-4 text-sm font-bold ring-1 ring-line">
                إضافة
              </button>
            </form>
          </section>
        </div>
      </div>

      <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 shadow-2xl ring-1 ring-line">
        <span className="min-w-0 text-sm">
          {error ? <span className="text-danger">{error}</span> : saved ? <span className="text-olive-700">{saved}</span> : dirty ? "لديك تعديلات غير محفوظة" : "لا تعديلات"}
        </span>
        <button type="button" onClick={save} disabled={!dirty || saving} className="shrink-0 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
