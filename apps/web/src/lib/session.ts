"use client";

import { useSyncExternalStore } from "react";
import { PUBLIC_API, readError } from "./api";
import type { SessionUser } from "./types";

const TOKEN_KEY = "tujjar_token";
const USER_KEY = "tujjar_user";
const EVENT = "tujjar-session";

type Session = SessionUser & { token: string };

let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function read(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    const raw = token && user ? `${token}|${user}` : null;
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSession = raw ? { ...(JSON.parse(user!) as SessionUser), token: token! } : null;
    }
    return cachedSession;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function hasToken(): boolean {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
}

export function updateSessionUser(user: SessionUser) {
  if (!localStorage.getItem(TOKEN_KEY)) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Authenticated request from client components. Sends JSON or FormData. */
export async function authFetch<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API}${path}`, { method, headers, body: payload, cache: "no-store" });
  } catch {
    throw new Error("تعذّر الاتصال، تحقق من الإنترنت وحاول مجدداً");
  }
  if (res.status === 401) {
    clearSession();
    throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");
  }
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
