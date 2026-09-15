"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@lib/api";
import { merchantFetch, setMerchantUser } from "@lib/session";
import { localPhone, normalizeSyrianMobile } from "@lib/input";
import { uploadImage } from "@lib/image";
import { useAuthData, type MerchantStore } from "@lib/merchant";
import type { Category, Governorate, SessionUser } from "@lib/types";
import { Field, FormError, SubmitButton, Toggle, inputClass, textareaClass } from "@components/forms/fields";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { ImageIcon } from "@components/ui/icons";

export default function StoreSettingsPage() {
  const { data: store, error: loadError } = useAuthData<MerchantStore>("/merchant/store");
  const [categories, setCategories] = useState<Category[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);

  useEffect(() => {
    Promise.all([apiGet<Category[]>("/categories"), apiGet<Governorate[]>("/governorates")])
      .then(([c, g]) => {
        setCategories(c);
        setGovernorates(g);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">إعدادات المتجر</h1>
      <FormError message={loadError} />
      {store && governorates.length > 0 ? (
        <StoreForm store={store} categories={categories} governorates={governorates} />
      ) : (
        !loadError && <div className="h-96 animate-pulse rounded-card bg-surface ring-1 ring-line" />
      )}
    </div>
  );
}

function StoreForm({
  store,
  categories,
  governorates,
}: {
  store: MerchantStore;
  categories: Category[];
  governorates: Governorate[];
}) {
  const [form, setForm] = useState({
    name: store.name,
    tagline: store.tagline ?? "",
    description: store.description ?? "",
    categoryId: store.categoryId ?? "",
    governorateId: store.governorateId,
    marketId: store.marketId ?? "",
    address: store.address ?? "",
    mapUrl: store.mapUrl ?? "",
    whatsapp: localPhone(store.whatsapp),
    phone: localPhone(store.phone),
    openingHours: store.openingHours ?? "",
    hasDelivery: store.hasDelivery,
    logoUrl: store.logoUrl ?? "",
    coverUrl: store.coverUrl ?? "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState<"" | "logoUrl" | "coverUrl">("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const markets = governorates.find((g) => g.id === form.governorateId)?.markets ?? [];

  async function pickImage(key: "logoUrl" | "coverUrl", file?: File) {
    if (!file) return;
    setUploading(key);
    setError("");
    try {
      set(key, await uploadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الصورة");
    } finally {
      setUploading("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!normalizeSyrianMobile(form.whatsapp)) return setError("رقم الواتساب غير صحيح، مثال: 0912345678");
    setPending(true);
    try {
      await merchantFetch("/merchant/store", {
        method: "PATCH",
        body: {
          ...form,
          marketId: form.marketId || undefined,
          categoryId: form.categoryId || undefined,
          mapUrl: form.mapUrl || undefined,
          phone: form.phone || undefined,
          logoUrl: form.logoUrl || undefined,
          coverUrl: form.coverUrl || undefined,
        },
      });
      const me = await merchantFetch<SessionUser>("/auth/me");
      setMerchantUser(me);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="overflow-hidden rounded-card bg-surface ring-1 ring-line">
        <label className="relative block h-36 cursor-pointer bg-gradient-to-l from-brand-100 to-olive-100">
          {form.coverUrl ? (
            <img src={form.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="pattern-arches absolute inset-0" />
          )}
          <span className="absolute end-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium">
            <ImageIcon size={15} /> {uploading === "coverUrl" ? "جارِ الرفع…" : "صورة الغلاف"}
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage("coverUrl", e.target.files?.[0])} />
        </label>
        <div className="flex items-end gap-4 px-5 pb-5">
          <label className="relative -mt-10 cursor-pointer">
            <StoreAvatar name={form.name || "م"} logoUrl={form.logoUrl || null} className="h-20 w-20 border-4 border-surface text-2xl" />
            <span className="absolute -bottom-1 -start-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-canvas">
              {uploading === "logoUrl" ? "…" : "الشعار"}
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage("logoUrl", e.target.files?.[0])} />
          </label>
          <p className="pb-1 text-xs text-muted">اضغط على الغلاف أو الشعار لتغييرهما.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">هوية المتجر</h2>
        <Field label="اسم المتجر">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} className={inputClass} />
        </Field>
        <Field label="جملة تعريفية" optional hint="تظهر تحت اسم المتجر، مثال: بهارات البزورية بالجملة والمفرق">
          <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={90} className={inputClass} />
        </Field>
        <Field label="القسم الرئيسي">
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
            <option value="">اختر</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="نبذة عن المتجر" optional>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={1500} className={textareaClass} />
        </Field>
      </section>

      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">التواصل</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم الواتساب" hint="هون بتوصلك رسائل الزبائن">
            <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} type="tel" dir="ltr" className={`${inputClass} text-left`} />
          </Field>
          <Field label="رقم للاتصال" optional hint="أرضي أو موبايل آخر">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} type="tel" dir="ltr" className={`${inputClass} text-left`} />
          </Field>
        </div>
        <Field label="أوقات الدوام" optional>
          <input value={form.openingHours} onChange={(e) => set("openingHours", e.target.value)} placeholder="مثال: يومياً 9 صباحاً – 8 مساءً" maxLength={80} className={inputClass} />
        </Field>
        <Toggle checked={form.hasDelivery} onChange={(v) => set("hasDelivery", v)} label="يوجد توصيل" description="يظهر شعار «توصيل» على متجرك ومنتجاتك" />
      </section>

      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">الموقع</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المحافظة">
            <select
              value={form.governorateId}
              onChange={(e) => setForm((f) => ({ ...f, governorateId: e.target.value, marketId: "" }))}
              className={inputClass}
            >
              {governorates.map((g) => (
                <option key={g.id} value={g.id} disabled={g.status === "COMING_SOON" && g.id !== store.governorateId}>
                  {g.name}
                  {g.status === "COMING_SOON" ? " (قريباً)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="السوق" optional>
            <select value={form.marketId} onChange={(e) => set("marketId", e.target.value)} className={inputClass}>
              <option value="">غير مدرج</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="العنوان التفصيلي" optional>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="مثال: سوق الحميدية، جانب محل…" maxLength={160} className={inputClass} />
        </Field>
        <Field label="رابط الموقع على خرائط Google" optional hint="افتح خرائط Google، اضغط على موقع المحل، ثم «مشاركة» وانسخ الرابط">
          <input value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} type="url" dir="ltr" className={`${inputClass} text-left`} />
        </Field>
      </section>

      {(store.earnedLevel === "LOCATION" || store.earnedLevel === "PREMIUM") &&
        (form.name.trim() !== store.name ||
          form.governorateId !== store.governorateId ||
          (form.marketId || null) !== store.marketId) && (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-7 text-brand-900 ring-1 ring-brand-100">
            تنبيه: تغيير اسم المتجر أو المحافظة أو السوق يلغي شارة «محل موثّق»، وستحتاج لتصوير فيديو جديد من المحل.
          </p>
        )}
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending || !!uploading}>حفظ الإعدادات</SubmitButton>
        {saved && <span className="text-sm font-medium text-olive-700">✓ تم الحفظ</span>}
      </div>
    </form>
  );
}
