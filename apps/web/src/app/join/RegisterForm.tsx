"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { OtpInput, PhoneInput, TermsCheckbox } from "@components/forms/auth-fields";
import { PASSWORD_HINT, isStrongPassword, normalizeSyrianMobile } from "@lib/input";
import { apiRequest, requestOtp, setSessionUser } from "@lib/session";
import type { SessionUser } from "@lib/types";

type Option = { id: string; name: string };
type Step = 1 | 2 | 3;

export function RegisterForm({
  categories,
  governorates,
}: {
  categories: (Option & { icon: string })[];
  governorates: (Option & { markets: Option[] })[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
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
    terms: false,
  });
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const markets = governorates.find((g) => g.id === form.governorateId)?.markets ?? [];

  function storeStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.storeName.trim().length < 2) return setError("اكتب اسم المتجر");
    if (!form.categoryId) return setError("اختر ماذا يبيع متجرك");
    if (!form.governorateId) return setError("اختر المحافظة");
    setStep(2);
  }

  async function sendCode() {
    const res = await requestOtp("merchant", form.phone, "REGISTER");
    setDevCode(res.devCode);
  }

  async function accountStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) return setError("اكتب اسمك الكامل");
    if (!normalizeSyrianMobile(form.phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
    if (!form.sameWhatsapp && !normalizeSyrianMobile(form.whatsapp)) return setError("رقم الواتساب غير صحيح");
    if (!isStrongPassword(form.password)) return setError(`كلمة المرور ${PASSWORD_HINT}`);
    if (!form.terms) return setError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية");
    setPending(true);
    try {
      await sendCode();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الرمز");
    } finally {
      setPending(false);
    }
  }

  async function verifyStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("اكتب الرمز المكوّن من 6 أرقام");
    setPending(true);
    try {
      const { user } = await apiRequest<{ user: SessionUser }>("/auth/register/merchant", {
        audience: "merchant",
        method: "POST",
        body: {
          storeName: form.storeName,
          categoryId: form.categoryId,
          governorateId: form.governorateId,
          marketId: form.marketId || undefined,
          name: form.name,
          phone: form.phone,
          whatsapp: form.sameWhatsapp ? undefined : form.whatsapp,
          password: form.password,
          otpCode: code,
          acceptTerms: true,
        },
      });
      setSessionUser("merchant", user);
      router.replace("/dashboard?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إنشاء المتجر");
      setPending(false);
    }
  }

  const back = (to: Step) => (
    <button type="button" onClick={() => setStep(to)} className="h-12 rounded-xl px-5 font-medium text-muted ring-1 ring-line hover:text-ink">
      رجوع
    </button>
  );

  return (
    <div className="mt-5">
      <ol className="mb-5 flex items-center gap-2 text-xs font-medium" aria-label="الخطوات">
        {["المتجر", "حسابك", "التحقق"].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step >= i + 1 ? "bg-brand-600 text-white" : "bg-sand text-muted"}`}>
              {i + 1}
            </span>
            <span className={step === i + 1 ? "text-ink" : "text-muted"}>{label}</span>
            {i < 2 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form onSubmit={storeStep} className="space-y-4" noValidate>
          <Field label="اسم المتجر" hint="كما هو مكتوب على لافتة المحل">
            <input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder="مثال: بهارات أبو فؤاد" maxLength={60} className={inputClass} />
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
              <select value={form.marketId} onChange={(e) => set("marketId", e.target.value)} disabled={!markets.length} className={inputClass}>
                <option value="">غير مدرج / لا يوجد</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <FormError message={error} />
          <button type="submit" className="h-12 w-full rounded-xl bg-ink font-bold text-canvas transition hover:bg-brand-900">التالي</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={accountStep} className="space-y-4" noValidate>
          <Field label="اسمك الكامل" hint="كما في الهوية الشخصية، للتوثيق">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={60} className={inputClass} />
          </Field>
          <Field label="رقم الموبايل" hint="تستخدمه لتسجيل الدخول، وسيصلك عليه رمز تحقق">
            <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sameWhatsapp} onChange={(e) => set("sameWhatsapp", e.target.checked)} className="h-4 w-4 accent-brand-600" />
            نفس الرقم عليه واتساب لاستقبال الزبائن
          </label>
          {!form.sameWhatsapp && (
            <Field label="رقم الواتساب للزبائن">
              <PhoneInput value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
            </Field>
          )}
          <Field label="كلمة المرور" hint={PASSWORD_HINT}>
            <input value={form.password} onChange={(e) => set("password", e.target.value)} type="password" autoComplete="new-password" className={inputClass} />
          </Field>
          <TermsCheckbox checked={form.terms} onChange={(v) => set("terms", v)} />
          <FormError message={error} />
          <div className="flex gap-2">
            {back(1)}
            <SubmitButton pending={pending} pendingLabel="جارِ إرسال الرمز…" className="flex-1">إرسال رمز التحقق</SubmitButton>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={verifyStep} className="space-y-4" noValidate>
          <OtpInput phone={form.phone} value={code} onChange={setCode} onResend={sendCode} devCode={devCode} />
          <FormError message={error} />
          <div className="flex gap-2">
            {back(2)}
            <SubmitButton pending={pending} pendingLabel="جارِ إنشاء المتجر…" className="flex-1">أنشئ متجري</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
