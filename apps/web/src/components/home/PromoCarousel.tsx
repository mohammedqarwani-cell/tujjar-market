"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type Promo = { href: string; eyebrow: string; title: string; cta: string; image?: string | null; tone: "brand" | "olive" | "ink" | "rose" };

const TONES: Record<Promo["tone"], string> = {
  brand: "from-brand-600 to-brand-500",
  olive: "from-olive-700 to-olive-500",
  ink: "from-ink to-[#3a3128]",
  rose: "from-[#9c2f22] to-danger",
};

/** Auto-advancing banner strip: swipe on phones, dots to jump, pauses while touched. */
export function PromoCarousel({ promos }: { promos: Promo[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft - (el.clientWidth - slide.clientWidth) / 2, behavior: "smooth" });
  };

  useEffect(() => {
    const t = setInterval(() => {
      if (!paused.current && document.visibilityState === "visible") goTo((index + 1) % promos.length);
    }, 4500);
    return () => clearInterval(t);
  }, [index, promos.length]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      [...el.children].forEach((c, i) => {
        const s = c as HTMLElement;
        const d = Math.abs(s.offsetLeft - el.offsetLeft + s.clientWidth / 2 - center);
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      });
      setIndex(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!promos.length) return null;
  return (
    <div
      onTouchStart={() => (paused.current = true)}
      onTouchEnd={() => setTimeout(() => (paused.current = false), 3000)}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4">
        {promos.map((p, i) => (
          <Link
            key={p.href + i}
            href={p.href}
            className={`press relative flex h-40 w-[86%] shrink-0 snap-center overflow-hidden rounded-3xl bg-gradient-to-l p-5 text-white shadow-card sm:h-48 md:w-[48%] ${TONES[p.tone]}`}
          >
            <div className="pattern-arches absolute inset-0 opacity-25 invert" />
            {p.image && (
              <img src={p.image} alt="" className="absolute bottom-0 end-0 h-full w-[46%] object-cover [mask-image:linear-gradient(to_left,black_55%,transparent)]" />
            )}
            <div className="relative flex max-w-[60%] flex-col">
              <span className="text-xs font-medium opacity-85">{p.eyebrow}</span>
              <span className="mt-1 text-xl font-bold leading-snug sm:text-2xl">{p.title}</span>
              <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                {p.cta} ←
              </span>
            </div>
          </Link>
        ))}
      </div>
      {promos.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {promos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`العرض ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-brand-600" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
