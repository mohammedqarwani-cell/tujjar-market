"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin progress bar at the top while the next page loads, so every tap gets instant feedback
 * (slow connections make this matter most).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setVisible(true);
      setWidth(12);
      clearInterval(timer.current);
      timer.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 180);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    clearInterval(timer.current);
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 260);
    return () => clearTimeout(t);
    // Finishes when the route actually changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px]">
      <div
        className="h-full bg-gradient-to-l from-brand-500 via-brand-600 to-olive-500 shadow-[0_0_8px_rgba(212,134,31,.6)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0, marginInlineStart: "auto" }}
      />
    </div>
  );
}
