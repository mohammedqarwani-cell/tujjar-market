"use client";

import { useState } from "react";
import { ShareIcon } from "@components/ui/icons";

export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return; // user cancelled the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex h-10 items-center gap-2 rounded-xl bg-surface px-3 text-sm font-medium ring-1 ring-line transition hover:ring-brand-200"
    >
      <ShareIcon size={17} />
      {copied ? "تم نسخ الرابط" : "مشاركة"}
    </button>
  );
}
