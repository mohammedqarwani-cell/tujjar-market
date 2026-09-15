"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toQuery } from "@lib/api";
import { webUrl } from "@lib/urls";
import { displayPhone, formatNumber, priceLabel, timeAgo } from "@lib/format";
import { adminFetch, apiRequest, signOut, useSession } from "@lib/session";
import type { Currency, Page, PriceType } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { LogoutIcon, VerifiedIcon } from "@components/ui/icons";
import { TotpSetup } from "./TotpSetup";

type Overview = {
  stores: number;
  suspended: number;
  unverified: number;
  products: number;
  underReview: number;
  openReports: number;
  merchants: number;
  buyers: number;
};

type AdminStore = {
  id: string;
  slug: string;
  name: string;
  whatsapp: string;
  isVerified: boolean;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  contactsCount: number;
  owner: { name: string; phone: string };
  governorate: { name: string };
  market: { name: string } | null;
  _count: { products: number; reports: number };
};

type AdminProduct = {
  id: string;
  title: string;
  price: number | null;
  currency: Currency;
  priceType: PriceType;
  images: string[];
  status: "ACTIVE" | "HIDDEN" | "UNDER_REVIEW";
  riskScore: number;
  isFeatured: boolean;
  createdAt: string;
  store: { slug: string; name: string };
  category: { name: string; icon: string };
};

type AdminReport = {
  id: string;
  reason: string;
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporter: { id: string; name: string; phone: string };
  store: { slug: string; name: string } | null;
  product: { id: string; title: string } | null;
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { name: string; role: string } | null;
};

const TABS = [
  { id: "products", label: "المنتجات", adminOnly: false },
  { id: "stores", label: "المتاجر", adminOnly: false },
  { id: "reports", label: "البلاغات", adminOnly: false },
  { id: "audit", label: "سجل التدقيق", adminOnly: true },
] as const;

type Tab = (typeof TABS)[number]["id"];

function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      setData(await adminFetch<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return { data, error, reload: load };
}

export default function AdminPage() {
  const { status, user } = useSession("admin");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/login");
  }, [status, router]);

  if (!user) return <div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10" aria-busy="true" />;
  if (user.mustSetupTotp || !user.mfa) return <TotpSetup />;

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة الإدارة</h1>
          <p className="text-sm text-muted">{user.name} · {isAdmin ? "مدير" : user.role === "MODERATOR" ? "مشرف" : "مندوب"}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut("admin");
            router.replace("/admin/login");
          }}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-danger"
        >
          <LogoutIcon size={17} /> خروج
        </button>
      </div>

      <OverviewCards />

      <div className="no-scrollbar mt-8 flex gap-1 overflow-x-auto rounded-xl bg-sand p-1 text-sm font-medium sm:w-fit">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-4 py-2 ${tab === t.id ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "stores" && <StoresTab canSuspend={isAdmin} />}
        {tab === "products" && <ProductsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "audit" && isAdmin && <AuditTab />}
      </div>
    </div>
  );
}

function OverviewCards() {
  const { data } = useAdminData<Overview>("/admin/overview");
  const cards = [
    { label: "المتاجر", value: data?.stores, sub: data ? `${data.unverified} غير موثّق` : "" },
    { label: "المنتجات", value: data?.products, sub: data ? `${data.underReview} قيد المراجعة` : "" },
    { label: "بلاغات مفتوحة", value: data?.openReports, sub: "تحتاج متابعة", alert: !!data?.openReports },
    { label: "المستخدمون", value: data ? data.merchants + data.buyers : undefined, sub: data ? `${data.merchants} تاجر · ${data.buyers} زبون` : "" },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-card bg-surface p-4 ring-1 ${c.alert ? "ring-danger/40" : "ring-line"}`}>
          <div className="text-sm text-muted">{c.label}</div>
          <div className="mt-1 text-3xl font-bold">{c.value == null ? "—" : formatNumber(c.value)}</div>
          <div className="mt-1 text-xs text-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (id: string, path: string, body: unknown) => {
    setBusy(id);
    setError("");
    try {
      await apiRequest(path, { audience: "admin", method: "PATCH", body });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy("");
    }
  };
  return { busy, error, run };
}

const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";
const selectClass = "h-10 rounded-xl border border-line bg-surface px-3 text-sm";

function StoresTab({ canSuspend }: { canSuspend: boolean }) {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, reload } = useAdminData<Page<AdminStore>>(
    `/admin/stores${toQuery({ q: query, pageSize: 100, ...(filter === "unverified" ? { verified: "0" } : filter ? { status: filter } : {}) })}`,
  );
  const action = useAction(reload);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={selectClass}>
          <option value="">كل المتاجر</option>
          <option value="unverified">غير موثّقة</option>
          <option value="SUSPENDED">موقوفة</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="بحث باسم المتجر…" className={selectClass} />
        </form>
      </div>
      <FormError message={error || action.error} />
      {data?.items.length === 0 && <EmptyState title="لا توجد متاجر" />}
      {data?.items.map((s) => (
        <article key={s.id} className={`flex flex-col gap-3 rounded-card bg-surface p-4 ring-1 ring-line sm:flex-row sm:items-center ${action.busy === s.id ? "opacity-50" : ""}`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={webUrl(`/stores/${s.slug}`)} target="_blank" className="font-bold hover:text-brand-700">{s.name}</Link>
              {s.isVerified && <VerifiedIcon size={16} className="text-olive-500" />}
              {s.status === "SUSPENDED" && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">موقوف</span>}
              {s._count.reports > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{s._count.reports} بلاغ</span>}
            </div>
            <div className="mt-1 text-xs leading-6 text-muted">
              {s.market ? `${s.market.name}، ` : ""}{s.governorate.name} · {s._count.products} منتج · {s.contactsCount} تواصل · انضم {timeAgo(s.createdAt)}
              <br />
              المالك: {s.owner.name} · <bdi dir="ltr">{displayPhone(s.owner.phone)}</bdi>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={!!action.busy}
              onClick={() => action.run(s.id, `/admin/stores/${s.id}/verification`, { isVerified: !s.isVerified })}
              className={`${chip} ${s.isVerified ? "text-muted ring-line" : "bg-olive-500 text-white ring-olive-500"}`}
            >
              {s.isVerified ? "إلغاء التوثيق" : "توثيق"}
            </button>
            {canSuspend && (
              <button
                type="button"
                disabled={!!action.busy}
                onClick={() => {
                  const suspend = s.status === "ACTIVE";
                  if (!suspend || confirm(`إيقاف «${s.name}»؟ سيختفي المتجر ومنتجاته عن الزبائن.`)) {
                    action.run(s.id, `/admin/stores/${s.id}/status`, { status: suspend ? "SUSPENDED" : "ACTIVE" });
                  }
                }}
                className={`${chip} ${s.status === "ACTIVE" ? "text-danger ring-danger/30" : "bg-ink text-canvas ring-ink"}`}
              >
                {s.status === "ACTIVE" ? "إيقاف" : "إعادة تفعيل"}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductsTab() {
  const [status, setStatus] = useState("UNDER_REVIEW");
  const { data, error, reload } = useAdminData<Page<AdminProduct>>(`/admin/products${toQuery({ status, pageSize: 100 })}`);
  const action = useAction(reload);

  return (
    <div className="space-y-3">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
        <option value="UNDER_REVIEW">قيد المراجعة</option>
        <option value="ACTIVE">معروضة</option>
        <option value="HIDDEN">مخفية</option>
        <option value="">الكل</option>
      </select>
      <FormError message={error || action.error} />
      {data?.items.length === 0 && (
        <EmptyState icon="✅" title={status === "UNDER_REVIEW" ? "لا توجد منتجات بانتظار المراجعة" : "لا توجد منتجات"} />
      )}
      {data?.items.map((p) => (
        <article key={p.id} className={`flex flex-col gap-3 rounded-card bg-surface p-4 ring-1 ring-line sm:flex-row sm:items-center ${action.busy === p.id ? "opacity-50" : ""}`}>
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-2xl">
              {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : p.category.icon}
            </div>
            <div className="min-w-0">
              <Link href={webUrl(`/products/${p.id}`)} target="_blank" className="line-clamp-1 font-semibold hover:text-brand-700">{p.title}</Link>
              <div className="mt-1 text-xs leading-6 text-muted">
                {priceLabel(p).main} · <Link href={webUrl(`/stores/${p.store.slug}`)} target="_blank" className="hover:text-ink">{p.store.name}</Link> · {timeAgo(p.createdAt)}
                {p.riskScore > 0 && <span className={`ms-2 font-bold ${p.riskScore >= 50 ? "text-danger" : "text-brand-700"}`}>مؤشر الخطورة {p.riskScore}</span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {p.status !== "ACTIVE" && (
              <button type="button" disabled={!!action.busy} onClick={() => action.run(p.id, `/admin/products/${p.id}`, { status: "ACTIVE" })} className={`${chip} bg-olive-500 text-white ring-olive-500`}>
                موافقة ونشر
              </button>
            )}
            {p.status !== "HIDDEN" && (
              <button type="button" disabled={!!action.busy} onClick={() => action.run(p.id, `/admin/products/${p.id}`, { status: "HIDDEN" })} className={`${chip} text-danger ring-danger/30`}>
                إخفاء
              </button>
            )}
            <button type="button" disabled={!!action.busy} onClick={() => action.run(p.id, `/admin/products/${p.id}`, { isFeatured: !p.isFeatured })} className={`${chip} ${p.isFeatured ? "bg-brand-600 text-white ring-brand-600" : "ring-line"}`}>
              {p.isFeatured ? "★ مميز" : "☆ تمييز"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState("OPEN");
  const { data, error, reload } = useAdminData<Page<AdminReport>>(`/admin/reports${toQuery({ status, pageSize: 100 })}`);
  const action = useAction(reload);

  return (
    <div className="space-y-3">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
        <option value="OPEN">مفتوحة</option>
        <option value="RESOLVED">تمت معالجتها</option>
        <option value="DISMISSED">مرفوضة</option>
      </select>
      <FormError message={error || action.error} />
      {data?.items.length === 0 && <EmptyState icon="🕊️" title="لا توجد بلاغات" />}
      {data?.items.map((r) => (
        <article key={r.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${action.busy === r.id ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-danger">{r.reason}</div>
              <div className="mt-1 text-sm text-muted">
                {r.product && (
                  <Link href={webUrl(`/products/${r.product.id}`)} target="_blank" className="font-medium text-ink hover:text-brand-700">منتج: {r.product.title}</Link>
                )}
                {r.store && (
                  <>
                    {r.product ? " · " : ""}
                    <Link href={webUrl(`/stores/${r.store.slug}`)} target="_blank" className="font-medium text-ink hover:text-brand-700">متجر: {r.store.name}</Link>
                  </>
                )}
                <span className="ms-2 text-xs">{timeAgo(r.createdAt)}</span>
              </div>
              <div className="mt-2 inline-flex flex-wrap items-center gap-x-2 rounded-lg bg-sand px-3 py-1.5 text-xs">
                <span className="text-muted">المُبلِّغ:</span>
                <span className="font-bold">{r.reporter.name}</span>
                <a href={`tel:+${r.reporter.phone}`} dir="ltr" className="font-medium text-brand-700">{displayPhone(r.reporter.phone)}</a>
              </div>
              {r.details && <p className="mt-2 rounded-xl bg-sand px-3 py-2 text-sm leading-7">{r.details}</p>}
            </div>
            {r.status === "OPEN" && (
              <div className="flex gap-2">
                <button type="button" disabled={!!action.busy} onClick={() => action.run(r.id, `/admin/reports/${r.id}`, { status: "RESOLVED" })} className={`${chip} bg-olive-500 text-white ring-olive-500`}>
                  تمت المعالجة
                </button>
                <button type="button" disabled={!!action.busy} onClick={() => action.run(r.id, `/admin/reports/${r.id}`, { status: "DISMISSED" })} className={`${chip} text-muted ring-line`}>
                  رفض
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.account_locked": "قفل الحساب",
  "auth.totp_enabled": "تفعيل المصادقة الثنائية",
  "auth.totp_failed": "رمز مصادقة خاطئ",
  "auth.password_reset": "تغيير كلمة المرور",
  "auth.refresh_token_reuse": "إعادة استخدام جلسة (اشتباه سرقة)",
  "user.register": "تسجيل زبون",
  "merchant.register": "تسجيل تاجر",
  "store.verify": "توثيق متجر",
  "store.unverify": "إلغاء توثيق",
  "store.suspend": "إيقاف متجر",
  "store.reactivate": "إعادة تفعيل متجر",
  "product.moderate": "مراجعة منتج",
  "report.create": "بلاغ جديد",
  "report.resolved": "معالجة بلاغ",
  "report.dismissed": "رفض بلاغ",
};

function AuditTab() {
  const { data, error } = useAdminData<Page<AuditLog>>("/admin/audit-logs?pageSize=100");
  return (
    <div className="space-y-3">
      <FormError message={error} />
      <div className="overflow-x-auto rounded-card bg-surface ring-1 ring-line">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-sand text-right text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">الوقت</th>
              <th className="px-4 py-2 font-medium">المنفّذ</th>
              <th className="px-4 py-2 font-medium">العملية</th>
              <th className="px-4 py-2 font-medium">العنصر</th>
              <th className="px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((log) => (
              <tr key={log.id} className="border-t border-line">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{timeAgo(log.createdAt)}</td>
                <td className="px-4 py-2">{log.actor?.name ?? "—"}</td>
                <td className={`px-4 py-2 font-medium ${log.action.includes("fail") || log.action.includes("reuse") || log.action.includes("locked") ? "text-danger" : ""}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </td>
                <td className="px-4 py-2 text-muted">{log.entityType}</td>
                <td dir="ltr" className="px-4 py-2 text-right font-mono text-xs text-muted">{log.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
