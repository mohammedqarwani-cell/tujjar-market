"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { inputClass } from "./fields";
import { onlyDigits } from "@lib/input";

export function PhoneInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      dir="ltr"
      placeholder="09xx xxx xxx"
      autoFocus={autoFocus}
      className={`${inputClass} text-left`}
    />
  );
}

/** Six-digit SMS code with a resend countdown. */
export function OtpInput({
  phone,
  value,
  onChange,
  onResend,
  devCode,
}: {
  phone: string;
  value: string;
  onChange: (v: string) => void;
  onResend: () => Promise<void>;
  devCode?: string;
}) {
  const [wait, setWait] = useState(60);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <div>
      <p className="mb-3 text-sm leading-6 text-muted">
        أرسلنا رمزاً من 6 أرقام برسالة SMS إلى <bdi dir="ltr" className="font-medium text-ink">{phone}</bdi>
      </p>
      <input
        value={value}
        onChange={(e) => onChange(onlyDigits(e.target.value, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        dir="ltr"
        placeholder="••••••"
        autoFocus
        aria-label="رمز التحقق"
        className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
      />
      {devCode && (
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-900">
          بيئة التطوير — الرمز: <bdi dir="ltr" className="font-bold">{devCode}</bdi>
        </p>
      )}
      <button
        type="button"
        disabled={wait > 0 || sending}
        onClick={async () => {
          setSending(true);
          try {
            await onResend();
            setWait(60);
          } finally {
            setSending(false);
          }
        }}
        className="mt-3 text-sm font-medium text-brand-700 disabled:text-muted"
      >
        {wait > 0 ? `إعادة الإرسال بعد ${wait} ثانية` : sending ? "جارِ الإرسال…" : "أعد إرسال الرمز"}
      </button>
    </div>
  );
}

export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
      />
      <span>
        قرأت وأوافق على{" "}
        <Link href="/terms" target="_blank" className="font-medium text-brand-700 underline">
          الشروط والأحكام
        </Link>{" "}
        و
        <Link href="/privacy" target="_blank" className="font-medium text-brand-700 underline">
          سياسة الخصوصية
        </Link>
      </span>
    </label>
  );
}
