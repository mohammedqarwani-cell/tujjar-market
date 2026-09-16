import type { NextConfig } from "next";

type AppInterface = "web" | "merchant" | "admin";

const appInterface = (process.env.APP_INTERFACE ?? "web") as AppInterface;
if (!["web", "merchant", "admin"].includes(appInterface)) {
  throw new Error(`Unknown APP_INTERFACE "${appInterface}" (expected web, merchant or admin)`);
}

const isDev = process.env.NODE_ENV !== "production";
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
// A relative API base ("/api") means the browser talks to this site's own proxy, covered by 'self'
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiOrigin = apiBase.startsWith("/") ? "" : new URL(apiBase).origin;
const mediaOrigin = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? "http://localhost:9000").origin;
/** When set, /api/* is proxied to this API so sessions stay first-party cookies on each interface's domain */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode also needs eval for fast refresh
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mediaOrigin}`,
  // Recorded shop videos are previewed, and reviewed by moderators, from in-memory blob URLs
  "media-src 'self' blob:",
  "font-src 'self'",
  // The push service worker (public/sw.js) is served from the same origin
  "worker-src 'self'",
  "manifest-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  // The merchant portal, the admin console and any demo deployment must never appear in search engines
  ...(appInterface === "web" && !demoMode ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  // An unrelated lockfile in E:\WEB made Next.js guess the wrong workspace root
  turbopack: { root: __dirname },
  poweredByHeader: false,
  // Each interface builds only its own route files (page.web.tsx, page.merchant.tsx, page.admin.tsx)
  // plus shared ones, so the buyer site never ships merchant or admin screens and vice versa.
  pageExtensions: [`${appInterface}.tsx`, `${appInterface}.ts`, "shared.tsx", "shared.ts"],
  // Locally the three interfaces share one folder, so each needs its own build output. A Vercel project
  // builds a single interface and expects the default .next folder.
  distDir: appInterface === "web" || process.env.VERCEL ? ".next" : `.next-${appInterface}`,
  // Route types are generated per interface; a shared tsconfig would type-check one interface's
  // pages against another's routes, so each build uses its own config.
  typescript: { tsconfigPath: `tsconfig.${appInterface}.json` },
  env: { NEXT_PUBLIC_APP_INTERFACE: appInterface },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return apiProxyTarget ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
};

export default nextConfig;
