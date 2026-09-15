import type { NextConfig } from "next";

type AppInterface = "web" | "merchant" | "admin";

const appInterface = (process.env.APP_INTERFACE ?? "web") as AppInterface;
if (!["web", "merchant", "admin"].includes(appInterface)) {
  throw new Error(`Unknown APP_INTERFACE "${appInterface}" (expected web, merchant or admin)`);
}

const isDev = process.env.NODE_ENV !== "production";
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").origin;
const mediaOrigin = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? "http://localhost:9000").origin;

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode also needs eval for fast refresh
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mediaOrigin}`,
  // Recorded shop videos are previewed, and reviewed by moderators, from in-memory blob URLs
  "media-src 'self' blob:",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}${isDev ? " ws: wss:" : ""}`,
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
  // The merchant portal and admin console must never appear in search engines
  ...(appInterface === "web" ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  // An unrelated lockfile in E:\WEB made Next.js guess the wrong workspace root
  turbopack: { root: __dirname },
  poweredByHeader: false,
  // Each interface builds only its own route files (page.web.tsx, page.merchant.tsx, page.admin.tsx)
  // plus shared ones, so the buyer site never ships merchant or admin screens and vice versa.
  pageExtensions: [`${appInterface}.tsx`, `${appInterface}.ts`, "shared.tsx", "shared.ts"],
  distDir: appInterface === "web" ? ".next" : `.next-${appInterface}`,
  // Route types are generated per interface; a shared tsconfig would type-check one interface's
  // pages against another's routes, so each build uses its own config.
  typescript: { tsconfigPath: `tsconfig.${appInterface}.json` },
  env: { NEXT_PUBLIC_APP_INTERFACE: appInterface },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
