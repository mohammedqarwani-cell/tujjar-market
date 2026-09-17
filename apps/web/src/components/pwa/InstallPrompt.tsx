"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@components/brand/Logo";
import { XIcon } from "@components/ui/icons";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const VISITS = "tj_visits";
const SNOOZE = "tj_install_snooze";

/** Invites returning visitors on phones to add the app to their home screen, like a native app. */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || window.innerWidth >= 768) return;
    let visits = 0;
    try {
      visits = Number(localStorage.getItem(VISITS) ?? 0) + 1;
      localStorage.setItem(VISITS, String(visits));
      if (Date.now() - Number(localStorage.getItem(SNOOZE) ?? 0) < 7 * 86_400_000) return;
    } catch {}
    if (visits < 2) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setTimeout(() => setOpen(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      const t = setTimeout(() => setOpen(true), 5000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!open || (!event && !ios)) return null;

  const close = () => {
    try {
      localStorage.setItem(SNOOZE, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  return (
    <div className="animate-slide-up fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[65] flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-2xl ring-1 ring-line md:hidden">
      <LogoMark size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">ثبّت تُجّار ماركت على موبايلك</div>
        <div className="text-xs leading-5 text-muted">
          {ios ? "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»" : "افتحه بلمسة من شاشتك، أسرع وبلا متصفح"}
        </div>
      </div>
      {event && (
        <button
          type="button"
          onClick={async () => {
            await event.prompt();
            await event.userChoice.catch(() => undefined);
            close();
          }}
          className="press shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white"
        >
          تثبيت
        </button>
      )}
      <button type="button" onClick={close} aria-label="إغلاق" className="shrink-0 p-1 text-muted">
        <XIcon size={18} />
      </button>
    </div>
  );
}
