import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "تُجّار ماركت",
    short_name: "تُجّار",
    description: "أسواق سوريا بين يديك: ابحث، قارن، وتواصل مع التاجر مباشرة.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#fbf7f1",
    theme_color: "#b86e14",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
