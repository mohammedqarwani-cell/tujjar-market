"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, useSession } from "@lib/session";
import { BellIcon } from "@components/ui/icons";

type FollowState = { following: boolean; followers: number };

/** Buyers follow a store to hear about its new products and offers. */
export function FollowButton({ storeSlug }: { storeSlug: string }) {
  const { status, user } = useSession("web", { lazy: true });
  const router = useRouter();
  const [state, setState] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/stores/${encodeURIComponent(storeSlug)}/follow`;

  useEffect(() => {
    if (status === "unknown" || status === "loading") return;
    apiRequest<FollowState>(path, { audience: "web" })
      .then(setState)
      .catch(() => setState({ following: false, followers: 0 }));
  }, [path, status, user?.id]);

  const toggle = async () => {
    if (!user) {
      router.push(`/account/login?next=${encodeURIComponent(`/stores/${storeSlug}`)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setState(await apiRequest<FollowState>(path, { audience: "web", method: state?.following ? "DELETE" : "POST" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ الطلب");
    } finally {
      setBusy(false);
    }
  };

  const following = !!state?.following;
  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !state}
        aria-pressed={following}
        className={`flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition disabled:opacity-60 ${following ? "bg-olive-50 text-olive-700 ring-1 ring-olive-100" : "bg-ink text-canvas hover:bg-ink/90"}`}
      >
        <BellIcon size={16} />
        {following ? "تتابع المتجر" : "تابع المتجر"}
        {state && state.followers > 0 && <span className="font-medium opacity-70">· {state.followers}</span>}
      </button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </div>
  );
}
