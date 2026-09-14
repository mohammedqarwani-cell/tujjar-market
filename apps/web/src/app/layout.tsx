import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@components/layout/SiteHeader";
import { SiteFooter } from "@components/layout/SiteFooter";
import { BottomNav } from "@components/layout/BottomNav";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-plex",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "تُجّار ماركت | أسواق سوريا بين يديك",
    template: "%s | تُجّار ماركت",
  },
  description:
    "ابحث عن المنتجات في أسواق سوريا، قارن الأسعار، وتواصل مع التاجر مباشرة على واتساب بدون وسيط.",
  applicationName: "تُجّار ماركت",
  openGraph: { locale: "ar_SY", type: "website", siteName: "تُجّار ماركت" },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plex.variable}>
      <body className="flex min-h-dvh flex-col font-sans antialiased pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}
