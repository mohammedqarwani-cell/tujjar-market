"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { LogoMark } from "@components/brand/Logo";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { OtpInput, PhoneInput } from "@components/forms/auth-fields";
import { PASSWORD_HINT, isStrongPassword, normalizeSyrianMobile } from "@lib/input";
import { apiRequest, requestOtp } from "@lib/session";
import { APP_INTERFACE } from "@lib/urls";

// The interface decides whose password is reset, so a buyer link can never reset a merchant account
const LOGIN: Record<"web" | "merchant", string> = { web: "/account/login", merchant: "/login" };

export default function ResetPasswordPage() {
  // Staff accounts are reset by an administrator, never by SMS
  if (APP_INTERFACE === "admin") notFound();
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-2xl font-bold">استعادة كلمة المرور</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}

function ResetForm() {
  const router = useRouter();
  const audience: "web" | "merchant" = APP_INTERFACE === "merchant" ? "merchant" : "web";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function sendCode() {
    const res = await requestOtp(audience, phone, "RESET_PASSWORD");
    setDevCode(res.devCode);
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!normalizeSyrianMobile(phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
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

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("اكتب الرمز المكوّن من 6 أرقام");
    if (!isStrongPassword(password)) return setError(`كلمة المرور ${PASSWORD_HINT}`);
    setPending(true);
    try {
      await apiRequest("/auth/password/reset", {
        audience,
        method: "POST",
        body: { phone, otpCode: code, newPassword: password },
      });
      router.replace(`${LOGIN[audience]}?reset=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تغيير كلمة المرور");
      setPending(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={submitReset} className="mt-6 space-y-4" noValidate>
        <OtpInput phone={phone} value={code} onChange={setCode} onResend={sendCode} devCode={devCode} />
        <Field label="كلمة المرور الجديدة" hint={PASSWORD_HINT}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className={inputClass} />
        </Field>
        <FormError message={error} />
        <SubmitButton pending={pending} className="w-full">حفظ كلمة المرور</SubmitButton>
        <p className="text-center text-xs text-muted">سيتم تسجيل الخروج من كل الأجهزة الأخرى.</p>
      </form>
    );
  }

  return (
    <form onSubmit={submitPhone} className="mt-6 space-y-4" noValidate>
      <p className="text-sm leading-6 text-muted">اكتب رقم موبايلك المسجّل، وسنرسل لك رمز تحقق.</p>
      <Field label="رقم الموبايل">
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ الإرسال…" className="w-full">أرسل الرمز</SubmitButton>
      <p className="text-center text-sm">
        <Link href={LOGIN[audience]} className="text-muted hover:text-brand-700">رجوع لتسجيل الدخول</Link>
      </p>
    </form>
  );
}
