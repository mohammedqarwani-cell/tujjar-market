import { PUBLIC_API } from "./api";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function post(path: string, body: unknown) {
  // Fire-and-forget: tracking must never block the buyer from contacting the store
  fetch(`${PUBLIC_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client": "web" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

export function trackContact(storeSlug: string, channel: "WHATSAPP" | "CALL", productId?: string) {
  post("/track/contact", { storeSlug, channel, productId });
}

export function trackView(target: { storeSlug?: string; productId?: string }) {
  post("/track/view", target);
}
