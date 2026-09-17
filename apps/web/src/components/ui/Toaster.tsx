"use client";

import { useEffect, useState } from "react";
import { onToast, type Toast } from "@lib/toast";
import { APP_INTERFACE } from "@lib/urls";

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        setItems((list) => [...list.slice(-2), t]);
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 2400);
      }),
    [],
  );

  if (!items.length) return null;
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 ${APP_INTERFACE === "web" ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-4"}`}
    >
      {items.map((t) => (
        <div key={t.id} className="animate-slide-up flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-xl">
          {t.icon && <span aria-hidden>{t.icon}</span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
