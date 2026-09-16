"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATEGORY_ICON,
  fetchNotifications,
  markNotificationsRead,
  timeAgo,
  useUnreadCount,
  type AppNotification,
} from "@lib/notifications";
import { useInterfaceSession } from "@components/notifications/useInterfaceSession";
import { PushCard } from "@components/notifications/PushCard";
import { SlidersIcon } from "@components/ui/icons";

export default function NotificationsPage() {
  const { user, audience } = useInterfaceSession();
  const router = useRouter();
  const unread = useUnreadCount(audience, !!user);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchNotifications(audience, `?page=${nextPage}&pageSize=20${filter === "unread" ? "&unread=1" : ""}`);
        setItems((list) => (replace ? res.items : [...list, ...res.items]));
        setPage(res.page);
        setPages(res.pages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر تحميل الإشعارات");
      } finally {
        setLoading(false);
      }
    },
    [audience, filter],
  );

  useEffect(() => {
    if (user) void load(1, true);
  }, [user, load]);

  if (!user) return <div className="mx-auto h-[60vh] max-w-2xl animate-pulse px-4 py-10" aria-busy="true" />;

  const open = async (n: AppNotification) => {
    if (!n.readAt) {
      await markNotificationsRead(audience, [n.id]).catch(() => undefined);
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.url) router.push(n.url);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">الإشعارات</h1>
        <Link href="/notifications/settings" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted ring-1 ring-line hover:text-ink">
          <SlidersIcon size={16} /> الإعدادات
        </Link>
      </div>

      <div className="mt-4">
        <PushCard audience={audience} compact />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-sand p-1 text-sm font-medium">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 ${filter === f ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {f === "all" ? "الكل" : `غير المقروءة${unread ? ` (${unread})` : ""}`}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={async () => {
              await markNotificationsRead(audience).catch(() => undefined);
              if (filter === "unread") setItems([]);
              else setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
            }}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            تحديد الكل كمقروء
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <ul className="mt-4 overflow-hidden rounded-card bg-surface ring-1 ring-line">
        {items.map((n) => (
          <li key={n.id} className="border-b border-line/60 last:border-0">
            <button
              type="button"
              onClick={() => open(n)}
              className={`flex w-full gap-3 px-4 py-4 text-start transition hover:bg-sand/60 ${n.readAt ? "" : "bg-brand-50/60"}`}
            >
              <span className="mt-0.5 text-xl leading-none" aria-hidden>{CATEGORY_ICON[n.category]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className={`leading-6 ${n.readAt ? "font-medium" : "font-bold"}`}>{n.title}</span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </span>
                <span className="mt-0.5 block text-sm leading-6 text-muted">{n.body}</span>
              </span>
            </button>
          </li>
        ))}
        {!loading && !items.length && (
          <li className="px-4 py-14 text-center text-muted">
            <div className="text-3xl" aria-hidden>🔔</div>
            <p className="mt-2">{filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات بعد"}</p>
          </li>
        )}
        {loading && <li className="h-24 animate-pulse" aria-busy="true" />}
      </ul>

      {page < pages && !loading && (
        <button
          type="button"
          onClick={() => load(page + 1, false)}
          className="mt-4 w-full rounded-xl bg-surface py-3 text-sm font-medium ring-1 ring-line hover:ring-brand-200"
        >
          عرض المزيد
        </button>
      )}
    </div>
  );
}
