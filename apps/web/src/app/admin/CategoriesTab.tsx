"use client";

import { useEffect, useState } from "react";
import { adminFetch, apiRequest } from "@lib/session";
import { FormError } from "@components/forms/fields";

type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  productsCount: number;
  storesCount: number;
};

const input = "h-10 rounded-xl border border-line bg-surface px-3 text-sm";
const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";
const message = (e: unknown) => (e instanceof Error ? e.message : "تعذّر تنفيذ العملية");
const send = (method: string, path: string, body?: unknown) => apiRequest(path, { audience: "admin", method, body });

/** Product and store categories. Disabling hides a category from lists and new listings only. */
export function CategoriesTab({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");

  const load = async () => {
    try {
      setItems(await adminFetch<AdminCategory[]>("/admin/categories"));
    } catch (e) {
      setError(message(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <div className="space-y-3">
      {isAdmin && <NewCategoryForm onCreated={load} />}
      <FormError message={error} />
      {items?.map((c) => (
        <article key={c.id} className={`rounded-card bg-surface p-4 ring-1 ring-line ${c.isActive ? "" : "opacity-75"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sand text-2xl">{c.icon}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{c.name}</span>
                  {!c.isActive && <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold text-muted">معطّل</span>}
                </div>
                <div className="text-xs text-muted">
                  <bdi dir="ltr">{c.slug}</bdi> · {c.productsCount} منتج · {c.storesCount} متجر · الترتيب {c.sortOrder}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditingId(editingId === c.id ? "" : c.id)} className={`${chip} ring-line`}>
                  {editingId === c.id ? "إغلاق" : "تعديل"}
                </button>
                <button type="button" onClick={() => run(() => send("PATCH", `/admin/categories/${c.id}`, { isActive: !c.isActive }))} className={`${chip} ring-line`}>
                  {c.isActive ? "تعطيل" : "تفعيل"}
                </button>
                {c.productsCount === 0 && c.storesCount === 0 && (
                  <button
                    type="button"
                    onClick={() => confirm(`حذف قسم «${c.name}» نهائياً؟`) && run(() => send("DELETE", `/admin/categories/${c.id}`))}
                    className={`${chip} text-danger ring-danger/30`}
                  >
                    حذف
                  </button>
                )}
              </div>
            )}
          </div>
          {editingId === c.id && (
            <CategoryEditor
              category={c}
              onSave={(body) =>
                run(async () => {
                  await send("PATCH", `/admin/categories/${c.id}`, body);
                  setEditingId("");
                })
              }
            />
          )}
        </article>
      ))}
    </div>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await send("POST", "/admin/categories", { name, icon });
      setName("");
      setIcon("");
      onCreated();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2 rounded-card bg-sand/60 p-3">
      <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🛍️" maxLength={8} aria-label="رمز القسم" className={`${input} w-16 text-center text-lg`} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم القسم الجديد" maxLength={40} className={`${input} min-w-[12rem] flex-1`} />
      <button type="submit" disabled={busy || name.trim().length < 2 || !icon.trim()} className={`${chip} h-10 bg-brand-600 px-4 text-sm text-white ring-brand-600`}>
        إضافة قسم
      </button>
      {error && (
        <div className="w-full">
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}

function CategoryEditor({
  category,
  onSave,
}: {
  category: AdminCategory;
  onSave: (body: { name: string; icon: string; slug: string; sortOrder: number }) => void;
}) {
  const [form, setForm] = useState({
    name: category.name,
    icon: category.icon,
    slug: category.slug,
    sortOrder: String(category.sortOrder),
  });

  return (
    <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[4rem_1fr_1fr_6rem_auto]">
      <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} maxLength={8} aria-label="الرمز" className={`${input} text-center text-lg`} />
      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} aria-label="الاسم" className={input} />
      <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} maxLength={48} dir="ltr" aria-label="الرابط المختصر" className={input} />
      <input value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} type="number" min={0} dir="ltr" aria-label="الترتيب" className={input} />
      <button
        type="button"
        onClick={() => onSave({ ...form, sortOrder: Number(form.sortOrder) || 0 })}
        className={`${chip} h-10 bg-ink px-4 text-sm text-canvas ring-ink`}
      >
        حفظ
      </button>
    </div>
  );
}
