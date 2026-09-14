"use client";

import { useState } from "react";
import { ProductArt } from "@components/catalog/ProductArt";

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

  if (!images.length) {
    return (
      <div className="aspect-square overflow-hidden rounded-card ring-1 ring-line">
        <ProductArt icon={icon} seed={seed} className="[&>span]:text-8xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-card bg-sand ring-1 ring-line">
        <img src={images[active]} alt={title} className="h-full w-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`الصورة ${i + 1}`}
              aria-current={i === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === active ? "ring-brand-500" : "ring-transparent opacity-70 hover:opacity-100"}`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
