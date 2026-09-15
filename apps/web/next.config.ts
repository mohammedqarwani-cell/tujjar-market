import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").origin;
const mediaOrigin = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? "http://localhost:9000").origin;

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode also needs eval for fast refresh
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mediaOrigin}`,
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
];

const nextConfig: NextConfig = {
  // An unrelated lockfile in E:\WEB made Next.js guess the wrong workspace root
  turbopack: { root: __dirname },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
