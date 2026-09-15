"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@components/brand/Logo";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { OtpInput, PhoneInput, TermsCheckbox } from "@components/forms/auth-fields";
import { PASSWORD_HINT, isStrongPassword, normalizeSyrianMobile } from "@lib/input";
import { apiRequest, requestOtp, setSessionUser } from "@lib/session";
import type { SessionUser } from "@lib/types";

export default function BuyerRegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-2xl font-bold">حساب جديد</h1>
        <p className="mt-1 text-sm text-muted">حساب موثّق برقم موبايلك، مجاني بالكامل.</p>
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        عندك حساب؟ <Link href="/account/login" className="font-bold text-brand-700">سجّل الدخول</Link>
      </p>
    </div>
  );
}

function RegisterForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function sendCode() {
    const res = await requestOtp("web", phone, "REGISTER");
    setDevCode(res.devCode);
  }

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("اكتب اسمك");
    if (!normalizeSyrianMobile(phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
    if (!isStrongPassword(password)) return setError(`كلمة المرور ${PASSWORD_HINT}`);
    if (!terms) return setError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية");
    setPending(true);
    try {
      await sendCode();
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الرمز");
    } finally {
      setPending(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("اكتب الرمز المكوّن من 6 أرقام");
    setPending(true);
    try {
      const { user } = await apiRequest<{ user: SessionUser }>("/auth/register/buyer", {
        audience: "web",
        method: "POST",
        body: { name, phone, password, otpCode: code, acceptTerms: true },
      });
      setSessionUser("web", user);
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إنشاء الحساب");
      setPending(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="mt-6 space-y-4" noValidate>
        <OtpInput phone={phone} value={code} onChange={setCode} onResend={sendCode} devCode={devCode} />
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep("details")} className="h-12 rounded-xl px-5 font-medium text-muted ring-1 ring-line">
            رجوع
          </button>
          <SubmitButton pending={pending} pendingLabel="جارِ التحقق…" className="flex-1">تأكيد وإنشاء الحساب</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitDetails} className="mt-6 space-y-4" noValidate>
      <Field label="الاسم">
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} className={inputClass} />
      </Field>
      <Field label="رقم الموبايل" hint="سيصلك رمز تحقق برسالة SMS">
        <PhoneInput value={phone} onChange={setPhone} />
      </Field>
      <Field label="كلمة المرور" hint={PASSWORD_HINT}>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className={inputClass} />
      </Field>
      <TermsCheckbox checked={terms} onChange={setTerms} />
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ إرسال الرمز…" className="w-full">متابعة</SubmitButton>
    </form>
  );
}
