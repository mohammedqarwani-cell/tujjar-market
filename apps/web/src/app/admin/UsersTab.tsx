"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@lib/session";
import { localPhone } from "@lib/input";
import { toQuery } from "@lib/api";

type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: "ADMIN" | "MODERATOR" | "FIELD_AGENT" | "MERCHANT" | "BUYER";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  lastLoginAt: string | null;
  locked: boolean;
  reportingBlocked: boolean;
  reportsConfirmed: number;
  reportsDismissed: number;
  credibility: number;
  totpEnabled: boolean;
  store: { slug: string; name: string; status: string; verificationLevel: string } | null;
  _count: { reviews: number; reports: number; favorites: number; follows: number };
};

const ROLE_LABEL: Record<AdminUser["role"], string> = {
  ADMIN: "مدير",
  MODERATOR: "مشرف",
  FIELD_AGENT: "مندوب",
  MERCHANT: "تاجر",
  BUYER: "زبون",
};

const selectClass = "h-10 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand-500";
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ar-SY", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [filters, setFilters] = useState({ q: "", role: "", status: "", flag: "" });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminUser[]; total: number; pages: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await adminFetch(`/admin/users${toQuery({ ...query, page, pageSize: 25 })}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (u: AdminUser, body: Record<string, unknown>, confirmText?: string) => {
    let note: string | undefined;
    if (body.status === "SUSPENDED") {
      note = window.prompt(`سبب إيقاف حساب ${u.name}:`) ?? undefined;
      if (!note?.trim()) return;
    } else if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setBusy(u.id);
    setError("");
    try {
      await adminFetch(`/admin/users/${u.id}`, { method: "PATCH", body: { ...body, ...(note ? { note } : {}) } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(filters);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          placeholder="اسم، رقم موبايل، أو اسم متجر"
          className={`${selectClass} min-w-56 flex-1`}
        />
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className={selectClass} aria-label="الدور">
          <option value="">كل الأدوار</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={selectClass} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">فعّال</option>
          <option value="SUSPENDED">موقوف</option>
        </select>
        <select value={filters.flag} onChange={(e) => setFilters({ ...filters, flag: e.target.value })} className={selectClass} aria-label="تنبيهات">
          <option value="">بلا تصفية</option>
          <option value="locked">مقفل مؤقتاً</option>
          <option value="reporting_blocked">موقوف عن البلاغات</option>
        </select>
        <button className="h-10 rounded-xl bg-ink px-5 text-sm font-bold text-canvas">بحث</button>
      </form>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {data && <p className="text-sm text-muted">{data.total} مستخدم</p>}

      <div className="overflow-x-auto rounded-card bg-surface ring-1 ring-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-sand/70 text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">المستخدم</th>
              <th className="px-4 py-2.5 text-start">الدور</th>
              <th className="px-4 py-2.5 text-start">النشاط</th>
              <th className="px-4 py-2.5 text-start">المصداقية</th>
              <th className="px-4 py-2.5 text-start">الحالة</th>
              {isAdmin && <th className="px-4 py-2.5 text-start">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-line/60 align-top">
                <td className="px-4 py-3">
                  <div className="font-bold">{u.name}</div>
                  <bdi dir="ltr" className="text-xs text-muted">{localPhone(u.phone)}</bdi>
                  {u.store && <div className="mt-0.5 text-xs text-brand-700">🏪 {u.store.name}</div>}
                </td>
                <td className="px-4 py-3">
                  {ROLE_LABEL[u.role]}
                  {["ADMIN", "MODERATOR", "FIELD_AGENT"].includes(u.role) && (
                    <div className={`text-[11px] ${u.totpEnabled ? "text-olive-700" : "text-danger"}`}>{u.totpEnabled ? "مصادقة ثنائية ✓" : "بلا مصادقة ثنائية"}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <div>انضم {date(u.createdAt)}</div>
                  <div>آخر دخول {date(u.lastLoginAt)}</div>
                  <div>
                    {u._count.reviews} تقييم · {u._count.reports} بلاغ · {u._count.follows} متابعة
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {u.reportsConfirmed + u.reportsDismissed > 0 ? (
                    <>
                      <div className="font-bold">{u.credibility}٪</div>
                      <div className="text-muted">
                        {u.reportsConfirmed} مؤكد · {u.reportsDismissed} مرفوض
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${u.status === "ACTIVE" ? "bg-olive-50 text-olive-700" : "bg-danger/10 text-danger"}`}>
                      {u.status === "ACTIVE" ? "فعّال" : "موقوف"}
                    </span>
                    {u.locked && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">مقفل مؤقتاً</span>}
                    {u.reportingBlocked && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">بلا بلاغات</span>}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy === u.id}
                          onClick={() => act(u, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }, u.status === "SUSPENDED" ? `إعادة تفعيل حساب ${u.name}؟` : undefined)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ring-1 disabled:opacity-50 ${u.status === "ACTIVE" ? "text-danger ring-danger/30" : "text-olive-700 ring-olive-100"}`}
                        >
                          {u.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                        </button>
                        {u.locked && (
                          <button type="button" disabled={busy === u.id} onClick={() => act(u, { unlock: true }, `فك قفل حساب ${u.name}؟`)} className="rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-line">
                            فك القفل
                          </button>
                        )}
                        {u.reportingBlocked && (
                          <button type="button" disabled={busy === u.id} onClick={() => act(u, { allowReporting: true }, `السماح لـ ${u.name} بالإبلاغ مجدداً؟`)} className="rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-line">
                            السماح بالبلاغات
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">لا يوجد مستخدمون مطابقون</td>
              </tr>
            )}
          </tbody>
        </table>
        {!data && !error && <div className="h-40 animate-pulse" />}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-line disabled:opacity-40">السابق</button>
          <span>{page} / {data.pages}</span>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-line disabled:opacity-40">التالي</button>
        </div>
      )}
    </div>
  );
}
