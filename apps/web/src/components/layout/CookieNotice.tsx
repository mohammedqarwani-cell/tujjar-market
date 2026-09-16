"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_INTERFACE } from "@lib/urls";

const KEY = "tj_cookie_notice";

/**
 * The platform only uses cookies the service can't work without (sign-in sessions, the chosen
 * governorate) and no tracking or advertising cookies, so no consent choice is needed: visitors are
 * informed once and can read the details in the privacy policy.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="ملفات تعريف الارتباط"
      // The buyer site has a bottom navigation bar on phones
      className={`fixed inset-x-0 z-40 flex justify-center px-3 md:bottom-4 ${APP_INTERFACE === "web" ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]" : "bottom-3"}`}
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-card bg-surface p-4 text-sm shadow-xl ring-1 ring-line sm:flex-row sm:items-center">
        <p className="flex-1 leading-6 text-ink/85">
          🍪 نستخدم ملفات تعريف ارتباط (كوكيز) ضرورية فقط: {APP_INTERFACE === "web" ? "لإبقائك مسجّلاً ولحفظ محافظتك المختارة" : "لإبقائك مسجّلاً بأمان"}. لا نستخدم كوكيز للتتبع أو الإعلانات.{" "}
          <Link href="/privacy#cookies" className="font-medium text-brand-700 underline">التفاصيل</Link>
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {}
            setShow(false);
          }}
          className="h-10 shrink-0 rounded-xl bg-ink px-5 font-bold text-canvas hover:bg-ink/90"
        >
          حسناً
        </button>
      </div>
    </div>
  );
}
