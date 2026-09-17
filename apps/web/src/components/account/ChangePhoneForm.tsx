"use client";

import { useState } from "react";
import { apiRequest, setSessionUser, type Audience } from "@lib/session";
import { localPhone, normalizeSyrianMobile } from "@lib/input";
import type { SessionUser } from "@lib/types";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { OtpInput } from "@components/forms/auth-fields";

/** Change the sign-in number: password + a code sent to the new number. */
export function ChangePhoneForm({ audience, currentPhone, isMerchant = false }: { audience: Audience; currentPhone: string; isMerchant?: boolean }) {
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [updateStore, setUpdateStore] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const sendCode = async () => {
    const r = await apiRequest<{ sent: boolean; devCode?: string }>("/auth/phone/otp", { audience, method: "POST", body: { newPhone } });
    setDevCode(r.devCode);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (step === "form") {
        if (!normalizeSyrianMobile(newPhone)) throw new Error("رقم الموبايل غير صحيح، مثال: 0912345678");
        if (!password) throw new Error("أدخل كلمة المرور الحالية");
        await sendCode();
        setStep("code");
      } else {
        const { user } = await apiRequest<{ user: SessionUser }>("/auth/phone", {
          audience,
          method: "POST",
          body: { newPhone, otpCode: code, password, ...(isMerchant ? { updateStoreContacts: updateStore } : {}) },
        });
        setSessionUser(audience, user);
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تغيير الرقم");
    } finally {
      setPending(false);
    }
  };

  if (step === "done") {
    return (
      <div className="rounded-card bg-olive-50 p-5 text-sm leading-7 text-olive-700 ring-1 ring-olive-100">
        ✓ تم تغيير رقم حسابك. استخدم الرقم الجديد لتسجيل الدخول من الآن، وسُجّل خروجك من الأجهزة الأخرى.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line" noValidate>
      <p className="text-sm text-muted">
        رقمك الحالي: <bdi dir="ltr" className="font-medium text-ink">{localPhone(currentPhone)}</bdi>
      </p>
      {step === "form" ? (
        <>
          <Field label="الرقم الجديد">
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" dir="ltr" placeholder="09xx xxx xxx" className={`${inputClass} text-left`} />
          </Field>
          <Field label="كلمة المرور الحالية" hint="للتأكد أنك صاحب الحساب">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className={inputClass} />
          </Field>
          {isMerchant && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={updateStore} onChange={(e) => setUpdateStore(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
              <span>استخدم الرقم الجديد أيضاً للواتساب والاتصال في متجري (إن كانا على الرقم القديم)</span>
            </label>
          )}
        </>
      ) : (
        <OtpInput phone={newPhone} value={code} onChange={setCode} onResend={sendCode} devCode={devCode} />
      )}
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>{step === "form" ? "إرسال رمز إلى الرقم الجديد" : "تأكيد تغيير الرقم"}</SubmitButton>
        {step === "code" && (
          <button type="button" onClick={() => setStep("form")} className="text-sm text-muted hover:text-ink">
            تعديل الرقم
          </button>
        )}
      </div>
    </form>
  );
}
