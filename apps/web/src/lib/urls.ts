export type AppInterface = "web" | "merchant" | "admin";

const trim = (url: string) => url.replace(/\/+$/, "");

/** Which interface this build serves; set from APP_INTERFACE in next.config.ts. */
export const APP_INTERFACE = (process.env.NEXT_PUBLIC_APP_INTERFACE ?? "web") as AppInterface;

export const WEB_URL = trim(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
export const MERCHANT_URL = trim(process.env.NEXT_PUBLIC_MERCHANT_URL ?? "http://localhost:3001");
export const ADMIN_URL = trim(process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002");

/** Links that cross interfaces must be absolute: each one runs on its own origin. */
export const webUrl = (path: string) => `${WEB_URL}${path}`;
export const merchantUrl = (path: string) => `${MERCHANT_URL}${path}`;
export const adminUrl = (path: string) => `${ADMIN_URL}${path}`;
