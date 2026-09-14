"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { PUBLIC_API, readError } from "@lib/api";
import { normalizeSyrianMobile } from "@lib/input";
import { saveSession } from "@lib/session";
import type { SessionUser } from "@lib/types";

type Option = { id: string; name: string };

export function RegisterForm({
  categories,
  governorates,
}: {
  categories: (Option & { icon: string })[];
  governorates: (Option & { markets: Option[] })[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    storeName: "",
    categoryId: "",
    governorateId: "",
    marketId: "",
    name: "",
    phone: "",
    sameWhatsapp: true,
    whatsapp: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const markets = governorates.find((g) => g.id === form.governorateId)?.markets ?? [];

  function nextStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.storeName.trim().length < 2) return setError("اكتب اسم المتجر");
    if (!form.categoryId) return setError("اختر ماذا يبيع متجرك");
    if (!form.governorateId) return setError("اختر المحافظة");
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) return setError("اكتب اسمك");
    if (!normalizeSyrianMobile(form.phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
    if (!form.sameWhatsapp && !normalizeSyrianMobile(form.whatsapp)) return setError("رقم الواتساب غير صحيح");
    if (form.password.length < 6) return setError("كلمة المرور 6 أحرف على الأقل");

    setPending(true);
    try {
      const res = await fetch(`${PUBLIC_API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: form.storeName,
          categoryId: form.categoryId,
          governorateId: form.governorateId,
          marketId: form.marketId || undefined,
          name: form.name,
          phone: form.phone,
          whatsapp: form.sameWhatsapp ? undefined : form.whatsapp,
          password: form.password,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const { token, user } = (await res.json()) as { token: string; user: SessionUser };
      saveSession(token, user);
      router.replace("/dashboard?welcome=1");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "تعذّر الاتصال، حاول مجدداً");
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <ol className="mb-5 flex items-center gap-2 text-xs font-medium" aria-label="الخطوات">
        {["معلومات المتجر", "حسابك"].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= i + 1 ? "bg-brand-600 text-white" : "bg-sand text-muted"}`}
            >
              {i + 1}
            </span>
            <span className={step === i + 1 ? "text-ink" : "text-muted"}>{label}</span>
            {i === 0 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form onSubmit={nextStep} className="space-y-4" noValidate>
          <Field label="اسم المتجر">
            <input
              value={form.storeName}
              onChange={(e) => set("storeName", e.target.value)}
              placeholder="مثال: بهارات أبو فؤاد"
              maxLength={60}
              className={inputClass}
            />
          </Field>
          <Field label="شو بيبيع متجرك؟">
            <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
              <option value="">اختر القسم</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المحافظة">
              <select
                value={form.governorateId}
                onChange={(e) => setForm((f) => ({ ...f, governorateId: e.target.value, marketId: "" }))}
                className={inputClass}
              >
                <option value="">اختر</option>
                {governorates.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>
            <Field label="السوق" optional>
              <select
                value={form.marketId}
                onChange={(e) => set("marketId", e.target.value)}
                disabled={!markets.length}
                className={inputClass}
              >
                <option value="">غير مدرج / لا يوجد</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <FormError message={error} />
          <button type="submit" className="h-12 w-full rounded-xl bg-ink font-bold text-canvas transition hover:bg-brand-900">
            التالي
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="اسمك">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={inputClass} />
          </Field>
          <Field label="رقم الموبايل" hint="تستخدمه لتسجيل الدخول">
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="09xx xxx xxx"
              className={`${inputClass} text-left`}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.sameWhatsapp}
              onChange={(e) => set("sameWhatsapp", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            نفس الرقم عليه واتساب لاستقبال الزبائن
          </label>
          {!form.sameWhatsapp && (
            <Field label="رقم الواتساب للزبائن">
              <input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="09xx xxx xxx"
                className={`${inputClass} text-left`}
              />
            </Field>
          )}
          <Field label="كلمة المرور" hint="6 أحرف على الأقل">
            <input
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              type="password"
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <FormError message={error} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-12 rounded-xl px-5 font-medium text-muted ring-1 ring-line hover:text-ink"
            >
              رجوع
            </button>
            <SubmitButton pending={pending} pendingLabel="جارِ إنشاء المتجر…" className="flex-1">
              أنشئ متجري
            </SubmitButton>
          </div>
          <p className="text-center text-xs leading-5 text-muted">
            بإنشاء المتجر توافق على عرض بيانات التواصل لمتجرك للزبائن.
          </p>
        </form>
      )}
    </div>
  );
}
