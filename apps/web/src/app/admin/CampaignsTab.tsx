"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@lib/session";

type Audience = "BUYERS" | "MERCHANTS" | "MERCHANTS_UNVERIFIED" | "ALL";
type Category = "PROMOTIONS" | "INVITES";

type Campaign = {
  id: string;
  category: Category;
  audience: Audience;
  title: string;
  body: string;
  url: string | null;
  status: "SENDING" | "SENT" | "FAILED";
  recipients: number;
  delivered: number;
  pushed: number;
  createdAt: string;
  createdBy: { name: string } | null;
};

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "BUYERS", label: "الزبائن", hint: "كل حسابات الزبائن" },
  { id: "MERCHANTS", label: "التجار", hint: "كل التجار" },
  { id: "MERCHANTS_UNVERIFIED", label: "تجار غير موثّقين", hint: "دعوة للتوثيق" },
  { id: "ALL", label: "الجميع", hint: "الزبائن والتجار" },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "PROMOTIONS", label: "عروض وأخبار" },
  { id: "INVITES", label: "دعوة" },
];

const STATUS: Record<Campaign["status"], string> = { SENDING: "قيد الإرسال", SENT: "أُرسلت", FAILED: "تعثّرت" };

const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function CampaignsTab() {
  const [audience, setAudience] = useState<Audience>("BUYERS");
  const [category, setCategory] = useState<Category>("PROMOTIONS");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [list, setList] = useState<Campaign[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const loadList = () =>
    adminFetch<{ items: Campaign[] }>("/admin/campaigns?pageSize=20")
      .then((r) => setList(r.items))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    setEstimate(null);
    adminFetch<{ recipients: number }>(`/admin/campaigns/estimate?audience=${audience}`)
      .then((r) => setEstimate(r.recipients))
      .catch(() => setEstimate(null));
  }, [audience]);

  useEffect(() => {
    if (!list?.some((c) => c.status === "SENDING")) return;
    const t = setTimeout(loadList, 3000);
    return () => clearTimeout(t);
  }, [list]);

  const send = async () => {
    setError("");
    setDone("");
    const audienceLabel = AUDIENCES.find((a) => a.id === audience)?.label;
    if (!window.confirm(`إرسال «${title}» إلى ${audienceLabel} (${estimate ?? "?"} مستخدم)؟ لا يمكن التراجع بعد الإرسال.`)) return;
    setBusy(true);
    try {
      await adminFetch("/admin/campaigns", {
        method: "POST",
        body: { audience, category, title, body, ...(url.trim() ? { url: url.trim() } : {}) },
      });
      setTitle("");
      setBody("");
      setUrl("");
      setDone("بدأ الإرسال. تصل الإشعارات حسب إعدادات كل مستخدم، وإشعارات الجهاز نهاراً فقط وبحد يومي.");
      void loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">حملة إشعارات جديدة</h2>
        <p className="mt-1 text-sm text-muted">عروض المواسم، افتتاح سوق، ميزة جديدة، أو دعوة التجار للتوثيق.</p>

        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">الجمهور</legend>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  aria-pressed={audience === a.id}
                  className={`rounded-xl px-3 py-2 text-start text-sm ring-1 ${audience === a.id ? "bg-ink text-canvas ring-ink" : "ring-line hover:ring-brand-200"}`}
                >
                  <span className="block font-bold">{a.label}</span>
                  <span className="block text-xs opacity-70">{a.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{estimate === null ? "…" : `${estimate} مستخدم`}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">النوع</legend>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${category === c.id ? "bg-ink text-canvas ring-ink" : "ring-line"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">العنوان</span>
            <input className={input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عروض العيد في أسواق دمشق" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">النص</span>
            <textarea className={`${input} min-h-24`} value={body} maxLength={240} onChange={(e) => setBody(e.target.value)} />
            <span className="mt-1 block text-xs text-muted">{body.length}/240</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">الصفحة عند الضغط (اختياري)</span>
            <input className={input} dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/search?offers=1" />
            <span className="mt-1 block text-xs text-muted">صفحة داخل المنصة تبدأ بـ /، في واجهة المستلم نفسه</span>
          </label>

          {(title || body) && (
            <div className="rounded-xl bg-sand/70 p-3">
              <div className="text-xs text-muted">معاينة</div>
              <div className="mt-1 font-bold">{title || "…"}</div>
              <div className="text-sm text-ink/80">{body || "…"}</div>
            </div>
          )}

          {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          {done && <p className="rounded-xl bg-olive-50 p-3 text-sm text-olive-700">{done}</p>}

          <button
            type="button"
            onClick={send}
            disabled={busy || title.trim().length < 3 || body.trim().length < 5}
            className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "جارٍ الإرسال…" : "إرسال الحملة"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-bold">الحملات السابقة</h2>
        <ul className="mt-3 space-y-3">
          {list?.map((c) => (
            <li key={c.id} className="rounded-card bg-surface p-4 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{c.title}</div>
                  <div className="mt-0.5 text-sm text-muted">{c.body}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${c.status === "SENT" ? "bg-olive-50 text-olive-700" : c.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-brand-50 text-brand-700"}`}
                >
                  {STATUS[c.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{AUDIENCES.find((a) => a.id === c.audience)?.label}</span>
                <span>المستهدفون: {c.recipients}</span>
                <span>داخل التطبيق: {c.delivered}</span>
                <span>على الأجهزة: {c.pushed}</span>
                <span>{new Date(c.createdAt).toLocaleString("ar-SY")}</span>
                {c.createdBy && <span>{c.createdBy.name}</span>}
              </div>
            </li>
          ))}
          {list?.length === 0 && <li className="rounded-card bg-surface p-6 text-center text-sm text-muted ring-1 ring-line">لم تُرسل حملات بعد</li>}
          {!list && <li className="h-32 animate-pulse rounded-card bg-surface ring-1 ring-line" />}
        </ul>
      </div>
    </div>
  );
}
