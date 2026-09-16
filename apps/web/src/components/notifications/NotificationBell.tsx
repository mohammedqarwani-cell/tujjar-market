"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, type Audience } from "@lib/session";
import {
  CATEGORY_ICON,
  fetchNotifications,
  markNotificationsRead,
  resyncPush,
  timeAgo,
  useUnreadCount,
  type AppNotification,
} from "@lib/notifications";
import { BellIcon } from "@components/ui/icons";
import { Portal } from "@components/ui/Portal";
import { PushPrompt } from "./PushPrompt";

export function NotificationBell({ audience, tone = "light" }: { audience: Audience; tone?: "light" | "dark" }) {
  const { user } = useSession(audience, { lazy: audience === "web" });
  const unread = useUnreadCount(audience, !!user);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (user) void resyncPush(audience);
  }, [user, audience]);

  useEffect(() => {
    if (!open) return;
    setError("");
    fetchNotifications(audience, "?pageSize=8")
      .then((page) => setItems(page.items))
      .catch((e: Error) => setError(e.message));
    const close = (e: MouseEvent | KeyboardEvent) => {
      const target = e.target as Node;
      const outside = !panel.current?.contains(target) && !dropdown.current?.contains(target);
      if (e instanceof KeyboardEvent ? e.key === "Escape" : outside) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, audience]);

  if (!user) return null;

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) await markNotificationsRead(audience, [n.id]).catch(() => undefined);
    router.push(n.url ?? "/notifications");
  };

  // Admins are asked only after two-factor sign-in, which the console requires for everything else
  const canPrompt = audience !== "admin" || user.mfa;

  return (
    <div ref={panel} className="relative">
      {canPrompt && <PushPrompt audience={audience} userId={user.id} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${tone === "dark" ? "text-canvas hover:bg-canvas/15" : "text-ink hover:bg-sand"}`}
      >
        <BellIcon size={21} />
        {unread > 0 && (
          <span className="absolute -top-0.5 end-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-canvas">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <Portal>
        <div
          ref={dropdown}
          className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-card bg-surface text-ink shadow-xl ring-1 ring-line sm:inset-x-auto sm:end-[max(1rem,calc((100vw-72rem)/2+1rem))] sm:w-[22rem]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">الإشعارات</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await markNotificationsRead(audience).catch(() => undefined);
                  setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
                }}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain">
            {error && <p className="p-4 text-sm text-danger">{error}</p>}
            {!items && !error && <div className="h-40 animate-pulse" aria-busy="true" />}
            {items?.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">لا توجد إشعارات بعد</p>
            )}
            {items?.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={`flex w-full gap-3 border-b border-line/60 px-4 py-3 text-start transition last:border-0 hover:bg-sand/60 ${n.readAt ? "" : "bg-brand-50/60"}`}
              >
                <span className="mt-0.5 text-lg leading-none" aria-hidden>{CATEGORY_ICON[n.category]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-6 ${n.readAt ? "font-medium" : "font-bold"}`}>{n.title}</span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="غير مقروء" />}
                  </span>
                  <span className="line-clamp-2 block text-xs leading-5 text-muted">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex border-t border-line text-sm font-medium">
            <Link href="/notifications" onClick={() => setOpen(false)} className="flex-1 px-4 py-3 text-center hover:bg-sand">
              كل الإشعارات
            </Link>
            <Link href="/notifications/settings" onClick={() => setOpen(false)} className="flex-1 border-s border-line px-4 py-3 text-center text-muted hover:bg-sand hover:text-ink">
              الإعدادات
            </Link>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
