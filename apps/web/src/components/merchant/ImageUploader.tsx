"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@lib/image";
import { ImageIcon, XIcon } from "@components/ui/icons";

export function ImageUploader({
  images,
  onChange,
  max = 6,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = max - images.length;
    const selected = Array.from(files).slice(0, room);
    if (files.length > room) setError(`يمكنك إضافة ${max} صور كحد أقصى`);

    setUploading(selected.length);
    let current = images;
    for (const file of selected) {
      try {
        const url = await uploadImage(file);
        current = [...current, url];
        onChange(current);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر رفع إحدى الصور");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  const makeCover = (i: number) => onChange([images[i], ...images.filter((_, j) => j !== i)]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {images.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-xl bg-sand ring-1 ring-line">
            <img src={src} alt="" className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[10px] font-bold text-white">الغلاف</span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(i)}
                className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                اجعلها الغلاف
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              aria-label="حذف الصورة"
              className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-ink shadow"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square animate-pulse items-center justify-center rounded-xl bg-sand text-xs text-muted">
            جارِ الرفع…
          </div>
        ))}

        {images.length + uploading < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface text-muted transition hover:border-brand-500 hover:text-brand-700"
          >
            <ImageIcon size={24} />
            <span className="text-xs font-medium">أضف صورة</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-2 text-xs text-muted">صوّر المنتج بإضاءة جيدة وخلفية بسيطة. الصور تُضغط تلقائياً قبل الرفع.</p>
    </div>
  );
}
