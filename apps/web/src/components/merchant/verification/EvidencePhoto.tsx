"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "@components/ui/icons";

/** Photo slot that opens the phone camera directly and previews the picture locally. */
export function EvidencePhoto({
  label,
  hint,
  capture,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  capture?: "user" | "environment";
  file?: File;
  onChange: (file?: File) => void;
}) {
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label
      className={`block cursor-pointer overflow-hidden rounded-card bg-surface ring-1 transition ${file ? "ring-olive-500" : "ring-line hover:ring-brand-200"}`}
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-sand">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm text-muted">
            <ImageIcon size={28} />
            اضغط للتصوير
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          {file && <span className="text-olive-600">✓</span>}
          {label}
        </div>
        <div className="mt-0.5 text-xs leading-5 text-muted">{hint}</div>
      </div>
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0])}
      />
    </label>
  );
}
