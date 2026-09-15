export const PUBLIC_API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const SERVER_API = (process.env.API_BASE_URL ?? PUBLIC_API).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readErrorBody(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const body = await res.json();
    const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
    if (typeof msg === "string" && msg) return { message: msg, code: typeof body?.code === "string" ? body.code : undefined };
  } catch {}
  return { message: res.status >= 500 ? "حدث خطأ في الخادم، حاول لاحقاً" : "تعذّر تنفيذ الطلب" };
}

export async function readError(res: Response): Promise<string> {
  return (await readErrorBody(res)).message;
}

/** Public GET used by server components; responses are cached briefly. */
export async function apiGet<T>(path: string, revalidate = 30): Promise<T> {
  const base = typeof window === "undefined" ? SERVER_API : PUBLIC_API;
  const res = await fetch(`${base}${path}`, { next: { revalidate } });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
