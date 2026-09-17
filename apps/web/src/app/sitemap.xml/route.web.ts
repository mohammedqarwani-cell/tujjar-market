import { apiGet } from "@lib/api";
import { webUrl } from "@lib/urls";

type SitemapData = {
  stores: { slug: string; updatedAt: string }[];
  products: { id: string; updatedAt: string }[];
  markets: { slug: string }[];
  categories: { slug: string }[];
};

export const revalidate = 3600;

const entry = (loc: string, lastmod?: string, priority = "0.6", changefreq = "weekly") =>
  `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

/** Every public page of the buyer site, so search engines find new stores and products quickly. */
export async function GET() {
  const data = await apiGet<SitemapData>("/sitemap", 3600).catch(() => null);
  const urls = [
    entry(webUrl("/"), undefined, "1.0", "daily"),
    entry(webUrl("/markets"), undefined, "0.8", "weekly"),
    entry(webUrl("/verification"), undefined, "0.3", "monthly"),
    ...(data?.categories ?? []).map((c) => entry(webUrl(`/categories/${c.slug}`), undefined, "0.8", "daily")),
    ...(data?.markets ?? []).map((m) => entry(webUrl(`/markets/${m.slug}`), undefined, "0.7", "weekly")),
    ...(data?.stores ?? []).map((s) => entry(webUrl(`/stores/${s.slug}`), s.updatedAt, "0.7", "weekly")),
    ...(data?.products ?? []).map((p) => entry(webUrl(`/products/${p.id}`), p.updatedAt, "0.6", "weekly")),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
