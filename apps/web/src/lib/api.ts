import { ENV } from "@lib/env";

type Options = RequestInit & { auth?: boolean };

export async function api<T = any>(
  path: string,
  opts: Options = {}
): Promise<T> {
  const headers: HeadersInit = { ...(opts.headers || {}) };
  if (typeof window !== "undefined" && opts.auth) {
    const token = localStorage.getItem("accessToken");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${ENV.API_BASE_URL}${path}`, {
    ...opts,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = "";
    try {
      msg = (await res.json()).message ?? "";
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    return {} as T;
  }
}
