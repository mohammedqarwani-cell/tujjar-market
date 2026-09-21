import { NextResponse, type NextRequest } from "next/server";

/**
 * The browser talks to this site's own /api path, never to the API host, so session cookies stay
 * first-party. This proxy forwards those calls and adds two headers the API trusts:
 *
 * - X-Proxy-Secret proves the request came through here, so the API can refuse anything sent
 *   straight to its public URL.
 * - X-Tujjar-Client-IP names the visitor, so per-IP limits count real people rather than this
 *   server. Both headers are stripped from the incoming request first: only ours may arrive.
 *
 * The file is named proxy.shared.ts because each interface builds only its own page extensions
 * (see pageExtensions in next.config.ts), and a plain proxy.ts would never be picked up.
 */
const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
const secret = process.env.API_PROXY_SECRET;

export default function proxy(request: NextRequest) {
  // Development talks to the API directly; nothing to proxy
  if (!target) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete("x-proxy-secret");
  headers.delete("x-tujjar-client-ip");
  if (secret) headers.set("x-proxy-secret", secret);

  const forwarded = request.headers.get("x-forwarded-for");
  const visitor = forwarded?.split(",")[0]?.trim();
  if (visitor) headers.set("x-tujjar-client-ip", visitor);

  const url = request.nextUrl;
  const destination = new URL(`${target}${url.pathname.replace(/^\/api/, "")}${url.search}`);
  return NextResponse.rewrite(destination, { request: { headers } });
}

export const config = { matcher: "/api/:path*" };
