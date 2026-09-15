"use client";

import { useState } from "react";
import { Field, FormError, SubmitButton, inputClass } from "@components/forms/fields";
import { PhoneInput } from "@components/forms/auth-fields";
import { normalizeSyrianMobile } from "@lib/input";
import { apiRequest } from "@lib/session";

/** Shown instead of registration when the merchant's governorate hasn't opened yet. */
export function InterestForm({
  governorateId,
  governorateName,
  storeName,
  categoryId,
}: {
  governorateId: string;
  governorateName: string;
  storeName: string;
  categoryId: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("اكتب اسمك");
    if (!normalizeSyrianMobile(phone)) return setError("رقم الموبايل غير صحيح، مثال: 0912345678");
    setPending(true);
    try {
      await apiRequest("/interest", {
        audience: "merchant",
        method: "POST",
        body: {
          governorateId,
          name,
          phone,
          storeName: storeName.trim() || undefined,
          categoryId: categoryId || undefined,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تسجيل اهتمامك");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-olive-50 p-4 text-sm leading-7 text-olive-700 ring-1 ring-olive-100">
        ✓ سجّلنا اهتمامك. سنتواصل معك على رقمك فور افتتاح التسجيل في {governorateName}.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-sand/70 p-4" noValidate>
      <p className="text-sm leading-7">
        التسجيل في <span className="font-bold">{governorateName}</span> يفتح قريباً. بدأنا بدمشق كتجربة لنضمن التحقق من كل
        محل. اترك رقمك ونتواصل معك أول الناس.
      </p>
      <Field label="اسمك">
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} className={inputClass} />
      </Field>
      <Field label="رقم الموبايل">
        <PhoneInput value={phone} onChange={setPhone} />
      </Field>
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ التسجيل…" className="w-full">
        أبلغوني عند الافتتاح
      </SubmitButton>
    </form>
  );
}
