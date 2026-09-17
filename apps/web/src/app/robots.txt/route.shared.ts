import { APP_INTERFACE, webUrl } from "@lib/urls";

export const dynamic = "force-static";

/**
 * Only the buyer site is indexed. The merchant portal, the admin console and any demo deployment
 * ask crawlers to stay out (they also send X-Robots-Tag: noindex).
 */
export function GET() {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const body =
    APP_INTERFACE === "web" && !demo
      ? `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /notifications\nDisallow: /favorites\n\nSitemap: ${webUrl("/sitemap.xml")}\n`
      : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
