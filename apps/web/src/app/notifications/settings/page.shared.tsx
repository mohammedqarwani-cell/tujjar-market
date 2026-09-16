"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPreferences, savePreferences, type CategoryPreference } from "@lib/notifications";
import { useInterfaceSession } from "@components/notifications/useInterfaceSession";
import { PushCard } from "@components/notifications/PushCard";

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-brand-600" : "bg-line"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "start-6" : "start-1"}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { user, audience } = useInterfaceSession();
  const [categories, setCategories] = useState<CategoryPreference[] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchPreferences(audience)
      .then((r) => setCategories(r.categories))
      .catch((e: Error) => setError(e.message));
  }, [user, audience]);

  if (!user) return <div className="mx-auto h-[60vh] max-w-2xl animate-pulse px-4 py-10" aria-busy="true" />;

  const update = async (key: CategoryPreference["key"], change: { inApp?: boolean; push?: boolean }) => {
    setError("");
    setSaved("");
    const previous = categories;
    setCategories((list) => list?.map((c) => (c.key === key ? { ...c, ...change } : c)) ?? null);
    try {
      const r = await savePreferences(audience, { [key]: change });
      setCategories(r.categories);
      setSaved("تم الحفظ");
    } catch (e) {
      setCategories(previous);
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8">
      <Link href="/notifications" className="text-sm text-muted hover:text-ink">→ الإشعارات</Link>
      <h1 className="mt-2 text-2xl font-bold">إعدادات الإشعارات</h1>
      <p className="mt-1 text-sm text-muted">اختر ما يصلك داخل التطبيق وما يصل إلى جهازك.</p>

      <div className="mt-5">
        <PushCard audience={audience} />
      </div>

      {error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 overflow-hidden rounded-card bg-surface ring-1 ring-line">
        <div className="hidden grid-cols-[1fr_4.5rem_4.5rem] gap-2 border-b border-line bg-sand/60 px-5 py-2.5 text-xs font-bold text-muted sm:grid">
          <span>النوع</span>
          <span className="text-center">داخل التطبيق</span>
          <span className="text-center">على الجهاز</span>
        </div>
        {!categories && !error && <div className="h-64 animate-pulse" aria-busy="true" />}
        {categories?.map((c) => (
          <div key={c.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 border-b border-line/60 px-5 py-4 last:border-0 sm:grid-cols-[1fr_4.5rem_4.5rem] sm:items-center">
            <div className="col-span-2 sm:col-span-1">
              <div className="font-bold">{c.label}</div>
              <div className="mt-0.5 text-sm leading-6 text-muted">{c.description}</div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm sm:justify-center">
              <span className="sm:hidden">داخل التطبيق</span>
              <Switch
                checked={c.inApp}
                disabled={c.inAppLocked}
                label={`${c.label}: داخل التطبيق`}
                onChange={(v) => update(c.key, { inApp: v })}
              />
            </label>
            <label className="col-start-2 row-start-2 flex items-center justify-between gap-3 text-sm sm:col-start-auto sm:row-start-auto sm:justify-center">
              <span className="sm:hidden">على الجهاز</span>
              <Switch checked={c.push} label={`${c.label}: على الجهاز`} onChange={(v) => update(c.key, { push: v })} />
            </label>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-6 text-muted" role="status">
        {saved || "إشعارات حسابك تبقى داخل التطبيق دائماً. العروض والتذكيرات لا تصل إلى جهازك ليلاً، وبحد أقصى 3 يومياً."}
      </p>
    </div>
  );
}
