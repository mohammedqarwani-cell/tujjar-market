"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PUBLIC_API, readErrorBody } from "./api";
import type { SessionUser } from "./types";

/**
 * Each interface (buyer site, merchant dashboard, admin) has its own session held in
 * httpOnly cookies set by the API. Tokens are never readable by JavaScript; this module
 * only keeps the signed-in profile in memory.
 */
export type Audience = "web" | "merchant" | "admin";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type SessionState = { status: "unknown" | "loading" | "authenticated" | "anonymous"; user: SessionUser | null };

const EVENT = "tujjar-session";
const SERVER_STATE: SessionState = { status: "unknown", user: null };
const states: Record<Audience, SessionState> = {
  web: SERVER_STATE,
  merchant: SERVER_STATE,
  admin: SERVER_STATE,
};

// Non-sensitive hint so pages don't call /auth/me for interfaces the visitor never signed in to
const hintKey = (aud: Audience) => `tj_signed_in_${aud}`;
const hasHint = (aud: Audience) => {
  try {
    return localStorage.getItem(hintKey(aud)) === "1";
  } catch {
    return false;
  }
};
const setHint = (aud: Audience, on: boolean) => {
  try {
    if (on) localStorage.setItem(hintKey(aud), "1");
    else localStorage.removeItem(hintKey(aud));
  } catch {}
};

function setState(aud: Audience, next: SessionState) {
  states[aud] = next;
  setHint(aud, next.status === "authenticated");
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/otp", "/auth/register", "/auth/password"];
const refreshing: Partial<Record<Audience, Promise<boolean>>> = {};

function send(path: string, aud: Audience, init: RequestInit) {
  return fetch(`${PUBLIC_API}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "X-Client": aud, ...(init.headers as Record<string, string> | undefined) },
  });
}

function refreshTokens(aud: Audience): Promise<boolean> {
  refreshing[aud] ??= send("/auth/refresh", aud, { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      delete refreshing[aud];
    });
  return refreshing[aud]!;
}

/** Authenticated request for one interface. Refreshes an expired session once, transparently. */
export async function apiRequest<T>(
  path: string,
  {
    audience,
    method = "GET",
    body,
    as = "json",
  }: { audience: Audience; method?: string; body?: unknown; as?: "json" | "blob" },
): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const attempt = async () => {
    try {
      return await send(path, audience, init);
    } catch {
      throw new ApiRequestError("تعذّر الاتصال، تحقق من الإنترنت وحاول مجدداً", 0);
    }
  };

  let res = await attempt();
  if (res.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshTokens(audience)) res = await attempt();
    if (res.status === 401) setState(audience, { status: "anonymous", user: null });
  }
  if (!res.ok) {
    const { message, code } = await readErrorBody(res);
    throw new ApiRequestError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (as === "blob" ? res.blob() : res.json()) as Promise<T>;
}

export const merchantFetch = <T>(path: string, opts: { method?: string; body?: unknown } = {}) =>
  apiRequest<T>(path, { ...opts, audience: "merchant" });

export const setMerchantUser = (user: SessionUser) => setSessionUser("merchant", user);

export const adminFetch =<T>(path: string, opts: { method?: string; body?: unknown } = {}) =>
  apiRequest<T>(path, { ...opts, audience: "admin" });

/** Protected file (verification evidence) as a Blob, shown through a short-lived object URL. */
export const adminBlob = (path: string) => apiRequest<Blob>(path, { audience: "admin", as: "blob" });

export async function loadSession(aud: Audience) {
  setState(aud, { status: "loading", user: states[aud].user });
  try {
    setState(aud, { status: "authenticated", user: await apiRequest<SessionUser>("/auth/me", { audience: aud }) });
  } catch {
    setState(aud, { status: "anonymous", user: null });
  }
}

/**
 * `lazy` skips the network check when this browser never signed in to that interface
 * (used by the public header), so anonymous visitors don't trigger 401s.
 */
export function useSession(aud: Audience, { lazy = false }: { lazy?: boolean } = {}): SessionState {
  const state = useSyncExternalStore(subscribe, () => states[aud], () => SERVER_STATE);
  useEffect(() => {
    if (states[aud].status !== "unknown") return;
    if (lazy && !hasHint(aud)) setState(aud, { status: "anonymous", user: null });
    else void loadSession(aud);
  }, [aud, lazy]);
  return state;
}

export function setSessionUser(aud: Audience, user: SessionUser) {
  setState(aud, { status: "authenticated", user });
}

export async function signIn(aud: Audience, body: { phone: string; password: string; totp?: string }) {
  const { user } = await apiRequest<{ user: SessionUser }>("/auth/login", { audience: aud, method: "POST", body });
  setSessionUser(aud, user);
  return user;
}

export async function signOut(aud: Audience) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) await apiRequest("/notifications/push/unsubscribe", { audience: aud, method: "POST", body: { endpoint: sub.endpoint } });
  } catch {}
  try {
    await apiRequest("/auth/logout", { audience: aud, method: "POST" });
  } catch {}
  setState(aud, { status: "anonymous", user: null });
}

export function requestOtp(aud: Audience, phone: string, purpose: "REGISTER" | "RESET_PASSWORD") {
  return apiRequest<{ sent: boolean; devCode?: string }>("/auth/otp", { audience: aud, method: "POST", body: { phone, purpose } });
}
