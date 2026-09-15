"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { PhoneInput } from "@components/forms/auth-fields";
import { normalizeSyrianMobile, onlyDigits } from "@lib/input";
import { ApiRequestError, signIn, type Audience } from "@lib/session";

const HOME: Record<Audience, string> = { web: "/account", merchant: "/dashboard", admin: "/admin" };

export function LoginForm({ audience }: { audience: Audience }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!normalizeSyrianMobile(phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
    if (!password) return setError("اكتب كلمة المرور");

    setPending(true);
    try {
      await signIn(audience, { phone, password, ...(needTotp ? { totp } : {}) });
      // Only same-site relative paths are accepted as a redirect target
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? HOME[audience]);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "TOTP_REQUIRED") {
        setNeedTotp(true);
        setError("");
      } else {
        setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <Field label="رقم الموبايل">
        <PhoneInput value={phone} onChange={setPhone} />
      </Field>
      <Field label="كلمة المرور">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      {needTotp && (
        <Field label="رمز المصادقة الثنائية" hint="من تطبيق المصادقة على موبايلك">
          <input
            value={totp}
            onChange={(e) => setTotp(onlyDigits(e.target.value, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            autoFocus
            className={`${inputClass} text-center text-xl font-bold tracking-[0.4em]`}
          />
        </Field>
      )}
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ الدخول…" className="w-full">
        دخول
      </SubmitButton>
      {audience !== "admin" && (
        <p className="text-center text-sm">
          <Link href="/reset-password" className="text-muted hover:text-brand-700">
            نسيت كلمة المرور؟
          </Link>
        </p>
      )}
    </form>
  );
}
