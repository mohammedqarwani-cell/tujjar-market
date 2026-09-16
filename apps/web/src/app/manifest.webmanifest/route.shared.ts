import type { MetadataRoute } from "next";
import { APP_INTERFACE } from "@lib/urls";

// A route handler instead of the manifest.ts convention: metadata files ignore the per-interface
// page extensions, so each interface builds its own installable identity here.
const IDENTITY: Record<typeof APP_INTERFACE, Pick<MetadataRoute.Manifest, "name" | "short_name" | "description" | "start_url">> = {
  web: {
    name: "تُجّار ماركت",
    short_name: "تُجّار",
    description: "أسواق سوريا بين يديك: ابحث، قارن، وتواصل مع التاجر مباشرة.",
    start_url: "/",
  },
  merchant: {
    name: "تُجّار ماركت — بوابة التجار",
    short_name: "تُجّار للتجار",
    description: "إدارة متجرك ومنتجاتك على تُجّار ماركت.",
    start_url: "/dashboard",
  },
  admin: {
    name: "تُجّار ماركت — لوحة الإدارة",
    short_name: "إدارة تُجّار",
    description: "لوحة إدارة تُجّار ماركت.",
    start_url: "/admin",
  },
};

export const dynamic = "force-static";

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    ...IDENTITY[APP_INTERFACE],
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#fbf7f1",
    theme_color: "#b86e14",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
