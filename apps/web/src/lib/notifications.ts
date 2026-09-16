"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiRequest, type Audience } from "./session";

export type NotificationCategory = "ACCOUNT" | "REVIEWS" | "FAVORITES" | "FOLLOWING" | "PROMOTIONS" | "INVITES" | "MODERATION";

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  url: string | null;
  count: number;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  unread: number;
};

export type CategoryPreference = {
  key: NotificationCategory;
  label: string;
  description: string;
  inAppLocked: boolean;
  inApp: boolean;
  push: boolean;
};

export const CATEGORY_ICON: Record<NotificationCategory, string> = {
  ACCOUNT: "👤",
  REVIEWS: "⭐",
  FAVORITES: "❤️",
  FOLLOWING: "🏪",
  PROMOTIONS: "🎁",
  INVITES: "✉️",
  MODERATION: "🛡️",
};

// ---------- unread counter (shared by the bell and the notifications page) ----------

const EVENT = "tujjar-unread";
const counts: Record<Audience, number> = { web: 0, merchant: 0, admin: 0 };
const POLL_MS = 60_000;

function setUnread(aud: Audience, value: number) {
  counts[aud] = value;
  window.dispatchEvent(new Event(EVENT));
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (value > 0) void nav.setAppBadge?.(value);
    else void nav.clearAppBadge?.();
  } catch {}
}

export async function refreshUnread(aud: Audience) {
  try {
    const { unread } = await apiRequest<{ unread: number }>("/notifications/unread-count", { audience: aud });
    setUnread(aud, unread);
  } catch {}
}

/** Unread count for a signed-in user, kept fresh by polling, focus, and messages from the service worker. */
export function useUnreadCount(aud: Audience, enabled: boolean) {
  const value = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    () => counts[aud],
    () => 0,
  );

  useEffect(() => {
    if (!enabled) return;
    void refreshUnread(aud);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnread(aud);
    }, POLL_MS);
    const onFocus = () => void refreshUnread(aud);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "tujjar-notification") void refreshUnread(aud);
    };
    window.addEventListener("focus", onFocus);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [aud, enabled]);

  return value;
}

export const fetchNotifications = (aud: Audience, query = "") =>
  apiRequest<NotificationPage>(`/notifications${query}`, { audience: aud });

export async function markNotificationsRead(aud: Audience, ids?: string[]) {
  const { unread } = await apiRequest<{ unread: number }>("/notifications/read", {
    audience: aud,
    method: "POST",
    body: ids ? { ids } : {},
  });
  setUnread(aud, unread);
}

export const fetchPreferences = (aud: Audience) =>
  apiRequest<{ categories: CategoryPreference[] }>("/notifications/preferences", { audience: aud });

export const savePreferences = (aud: Audience, prefs: Partial<Record<NotificationCategory, { inApp?: boolean; push?: boolean }>>) =>
  apiRequest<{ categories: CategoryPreference[] }>("/notifications/preferences", { audience: aud, method: "PUT", body: { prefs } });

export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar-SY", { day: "numeric", month: "long" });
}

// ---------- Web Push ----------

export type PushState = "unsupported" | "ios-install" | "denied" | "enabled" | "disabled";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "disabled";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

async function sendSubscription(aud: Audience, sub: PushSubscription) {
  const json = sub.toJSON();
  await apiRequest("/notifications/push/subscribe", {
    audience: aud,
    method: "POST",
    body: { endpoint: json.endpoint, keys: json.keys },
  });
}

/** Asks for permission (from a user tap), subscribes this device and registers it with the account. */
export async function enablePush(aud: Audience): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "disabled";

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await apiRequest<{ publicKey: string }>("/notifications/push/key", { audience: aud });
  const key = base64UrlToBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const current = sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (!current || current.length !== key.length || current.some((b, i) => b !== key[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await sendSubscription(aud, sub);
  return "enabled";
}

export async function disablePush(aud: Audience): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await apiRequest("/notifications/push/unsubscribe", { audience: aud, method: "POST", body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "disabled";
}

/** Re-links an already permitted device after signing in (or when the push service rotated it). */
export async function resyncPush(aud: Audience) {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sendSubscription(aud, sub);
  } catch {}
}

export async function sendTestPush(aud: Audience) {
  return apiRequest<{ devices: number; delivered: number }>("/notifications/push/test", { audience: aud, method: "POST" });
}
