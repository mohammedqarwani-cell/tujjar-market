import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootShell } from "@components/layout/RootShell";
import { SiteHeader } from "@components/layout/SiteHeader";
import { SiteFooter } from "@components/layout/SiteFooter";
import { BottomNav } from "@components/layout/BottomNav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "تُجّار ماركت | أسواق سوريا بين يديك",
    template: "%s | تُجّار ماركت",
  },
  description:
    "ابحث عن المنتجات في أسواق سوريا، قارن الأسعار، وتواصل مع التاجر مباشرة على واتساب بدون وسيط.",
  applicationName: "تُجّار ماركت",
  manifest: "/manifest.webmanifest",
  openGraph: { locale: "ar_SY", type: "website", siteName: "تُجّار ماركت" },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f1",
  width: "device-width",
  initialScale: 1,
};

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell
      header={<SiteHeader />}
      footer={
        <>
          <SiteFooter />
          <BottomNav />
        </>
      }
      bodyClassName="pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      {children}
    </RootShell>
  );
}
