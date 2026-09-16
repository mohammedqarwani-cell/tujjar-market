"use client";

import { useEffect, useState } from "react";
import type { Audience } from "@lib/session";
import { enablePush, getPushState, type PushState } from "@lib/notifications";
import { BellIcon } from "@components/ui/icons";
import { Portal } from "@components/ui/Portal";

/** After "later", ask again after this long */
const SNOOZE_MS = 3 * 86_400_000;
const SHOW_AFTER_MS = 1200;

const REASONS: Record<Audience, string> = {
  web: "ليصلك انخفاض أسعار مفضلتك، وعروض المتاجر التي تتابعها، وردود التجار على تقييماتك، حتى والتطبيق مغلق.",
  merchant: "ليصلك فوراً كل تقييم جديد لمتجرك، وقرارات التوثيق، وأي تنبيه يخص متجرك ومنتجاتك.",
  admin: "لتصلك فوراً طلبات التوثيق والبلاغات والتقييمات التي تنتظر المراجعة.",
};

const snoozeKey = (aud: Audience, userId: string) => `tj_push_prompt_${aud}_${userId}`;

/**
 * Asks a signed-in user to turn on device notifications. Browsers only allow the permission
 * request from a tap, so this dialog comes first; it doesn't return for a few days after "later".
 */
export function PushPrompt({ audience, userId }: { audience: Audience; userId: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const snoozedAt = Number(localStorage.getItem(snoozeKey(audience, userId)) ?? 0);
        if (Date.now() - snoozedAt < SNOOZE_MS) return;
      } catch {}
      const current = await getPushState().catch(() => "unsupported" as PushState);
      if (cancelled) return;
      setState(current);
      if (current === "disabled" || current === "ios-install") setOpen(true);
    }, SHOW_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience, userId]);

  if (!open || !state) return null;

  const later = () => {
    try {
      localStorage.setItem(snoozeKey(audience, userId), String(Date.now()));
    } catch {}
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await enablePush(audience);
      if (next === "enabled" || next === "denied") {
        setOpen(false);
        if (next === "denied") later();
      } else {
        setError("لم يُسمح بالإشعارات. يمكنك تفعيلها لاحقاً من إعدادات الإشعارات");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تفعيل الإشعارات");
    } finally {
      setBusy(false);
    }
  };

  const ios = state === "ios-install";

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-[2px] sm:items-center" role="presentation" onClick={later}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-card bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink shadow-2xl ring-1 ring-line sm:pb-6"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
          <BellIcon size={28} />
        </span>
        <h2 id="push-prompt-title" className="mt-4 text-center text-lg font-bold">
          {ios ? "أضف التطبيق لتصلك الإشعارات" : "فعّل الإشعارات"}
        </h2>
        <p className="mt-2 text-center text-sm leading-7 text-muted">
          {ios
            ? "على الآيفون: اضغط زر المشاركة في المتصفح ثم «إضافة إلى الشاشة الرئيسية»، وافتح تُجّار ماركت من هناك لتفعيل الإشعارات."
            : REASONS[audience]}
        </p>
        {error && <p className="mt-3 rounded-xl bg-danger/10 p-2.5 text-center text-xs text-danger">{error}</p>}
        <div className="mt-5 flex flex-col gap-2">
          {!ios && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="h-12 rounded-xl bg-brand-600 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
            </button>
          )}
          <button type="button" onClick={later} className="h-11 rounded-xl font-medium text-muted hover:bg-sand hover:text-ink">
            {ios ? "حسناً" : "لاحقاً"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
