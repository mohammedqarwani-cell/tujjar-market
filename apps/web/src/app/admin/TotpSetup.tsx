"use client";

import { useEffect, useState } from "react";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { ShieldIcon } from "@components/ui/icons";
import { onlyDigits } from "@lib/input";
import { adminFetch, setSessionUser } from "@lib/session";
import type { SessionUser } from "@lib/types";

/** First sign-in for staff: two-factor authentication must be enabled before any admin action. */
export function TotpSetup() {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    adminFetch<{ secret: string; otpauthUrl: string }>("/auth/totp/setup", { method: "POST" })
      .then(setSetup)
      .catch((e) => setError(e instanceof Error ? e.message : "تعذّر بدء الإعداد"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("اكتب الرمز المكوّن من 6 أرقام");
    setPending(true);
    try {
      const { user } = await adminFetch<{ user: SessionUser }>("/auth/totp/enable", { method: "POST", body: { code } });
      setSessionUser("admin", user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "رمز غير صحيح");
      setPending(false);
    }
  }

  const grouped = setup?.secret.match(/.{1,4}/g)?.join(" ");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-card bg-surface p-6 ring-1 ring-line sm:p-8">
        <ShieldIcon size={36} className="text-brand-600" />
        <h1 className="mt-3 text-2xl font-bold">فعّل المصادقة الثنائية</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          حماية إلزامية لحسابات فريق الإدارة. ثبّت تطبيق مصادقة على موبايلك (Google Authenticator أو Microsoft
          Authenticator)، ثم أضف الحساب بالمفتاح التالي.
        </p>

        {setup && (
          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-sand p-4 text-center">
              <div className="text-xs text-muted">مفتاح الإعداد</div>
              <div dir="ltr" className="mt-1 select-all font-mono text-lg font-bold tracking-wider">{grouped}</div>
            </div>
            <a href={setup.otpauthUrl} className="block text-center text-sm font-medium text-brand-700 underline">
              افتح مباشرة في تطبيق المصادقة (من الموبايل)
            </a>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="الرمز الظاهر في التطبيق">
            <input
              value={code}
              onChange={(e) => setCode(onlyDigits(e.target.value, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
            />
          </Field>
          <FormError message={error} />
          <SubmitButton pending={pending} pendingLabel="جارِ التحقق…" className="w-full">تفعيل ومتابعة</SubmitButton>
        </form>
      </div>
    </div>
  );
}
