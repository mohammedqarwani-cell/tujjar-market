"use client";

import { useEffect, useState } from "react";
import type { Audience } from "@lib/session";
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from "@lib/notifications";
import { BellIcon } from "@components/ui/icons";

const MESSAGES: Record<PushState, string> = {
  enabled: "تصلك الإشعارات على هذا الجهاز حتى والتطبيق مغلق.",
  disabled: "فعّلها لتصلك الإشعارات المهمة والعروض على هذا الجهاز حتى والتطبيق مغلق.",
  denied: "المتصفح يمنع الإشعارات لهذا الموقع. اسمح بها من إعدادات الموقع في المتصفح ثم أعد المحاولة.",
  "ios-install": "على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من هناك لتفعيل الإشعارات.",
  unsupported: "هذا المتصفح لا يدعم إشعارات الجهاز. جرّب Chrome أو Edge أو Firefox، والإشعارات داخل التطبيق تعمل دائماً.",
};

/** Device-level Web Push switch; `compact` shows only a prompt when push is off. */
export function PushCard({ audience, compact = false }: { audience: Audience; compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (!state || (compact && state !== "disabled")) return null;

  const run = async (action: () => Promise<PushState>) => {
    setBusy(true);
    setNote("");
    try {
      setState(await action());
    } catch (e) {
      setNote(e instanceof Error ? e.message : "تعذّر تفعيل الإشعارات");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-card p-5 ring-1 ${state === "enabled" ? "bg-olive-50 ring-olive-100" : "bg-brand-50 ring-brand-100"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${state === "enabled" ? "bg-olive-600" : "bg-brand-600"} text-white`}>
          <BellIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{state === "enabled" ? "إشعارات الجهاز مفعّلة" : "إشعارات الجهاز"}</h2>
          <p className="mt-1 text-sm leading-6 text-ink/80">{MESSAGES[state]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state === "disabled" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => enablePush(audience))}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
              </button>
            )}
            {state === "enabled" && !compact && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setNote("");
                    try {
                      const r = await sendTestPush(audience);
                      setNote(r.delivered ? "أُرسل إشعار تجريبي، يجب أن يظهر خلال ثوانٍ" : "لم يصل الإشعار، أعد تفعيل الإشعارات على هذا الجهاز");
                      if (!r.delivered) setState("disabled");
                    } catch (e) {
                      setNote(e instanceof Error ? e.message : "تعذّر الإرسال");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-brand-200 disabled:opacity-60"
                >
                  إرسال إشعار تجريبي
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => disablePush(audience))}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:text-danger disabled:opacity-60"
                >
                  إيقاف على هذا الجهاز
                </button>
              </>
            )}
          </div>
          {note && <p className="mt-2 text-xs text-ink/80" role="status">{note}</p>}
        </div>
      </div>
    </div>
  );
}
