"use client";

import { useRef, useState } from "react";
import { ProductArt } from "@components/catalog/ProductArt";
import { ChevronLeftIcon, ChevronRightIcon } from "@components/ui/icons";

/**
 * Product photos: one large image with arrows, swipe and a counter, and thumbnails that always fit
 * the column width (up to 6 photos), so many photos never widen the page.
 */
export function ProductGallery({
  images,
  title,
  icon,
  seed,
}: {
  images: string[];
  title: string;
  icon: string;
  seed: string;
}) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  if (!images.length) {
    return (
      <div className="aspect-square overflow-hidden rounded-card ring-1 ring-line">
        <ProductArt icon={icon} seed={seed} className="[&>span]:text-8xl" />
      </div>
    );
  }

  const count = images.length;
  const go = (i: number) => setActive((i + count) % count);

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="relative aspect-square overflow-hidden rounded-card bg-sand ring-1 ring-line"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null || count < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          // Right-to-left layout: swiping left shows the next photo
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        }}
      >
        <img src={images[active]} alt={`${title}${count > 1 ? ` – الصورة ${active + 1}` : ""}`} className="h-full w-full object-contain" />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="الصورة السابقة"
              className="absolute start-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow ring-1 ring-line backdrop-blur hover:bg-surface"
            >
              <ChevronRightIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="الصورة التالية"
              className="absolute end-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow ring-1 ring-line backdrop-blur hover:bg-surface"
            >
              <ChevronLeftIcon size={20} />
            </button>
            <span className="absolute bottom-3 start-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-canvas" dir="ltr">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="grid grid-cols-6 gap-2">
          {images.map((src, i) => (
            <button
              key={`${i}-${src}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`الصورة ${i + 1}`}
              aria-current={i === active}
              className={`aspect-square min-w-0 overflow-hidden rounded-xl ring-2 transition ${i === active ? "ring-brand-500" : "ring-transparent opacity-70 hover:opacity-100"}`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
