"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { PUBLIC_API, readError } from "@lib/api";
import { normalizeSyrianMobile } from "@lib/input";
import { saveSession } from "@lib/session";
import type { SessionUser } from "@lib/types";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!normalizeSyrianMobile(phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");

    setPending(true);
    try {
      const res = await fetch(`${PUBLIC_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const { token, user } = (await res.json()) as { token: string; user: SessionUser };
      saveSession(token, user);
      const fallback = user.role === "ADMIN" ? "/admin" : "/dashboard";
      router.replace(next?.startsWith("/") ? next : fallback);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "تعذّر الاتصال، حاول مجدداً");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <Field label="رقم الموبايل">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="09xx xxx xxx"
          className={`${inputClass} text-left`}
          required
        />
      </Field>
      <Field label="كلمة المرور">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          className={inputClass}
          required
        />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ الدخول…" className="w-full">
        دخول
      </SubmitButton>
    </form>
  );
}
