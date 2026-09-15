import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootShell } from "@components/layout/RootShell";
import { PortalFooter, PortalHeader } from "@components/layout/PortalHeader";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MERCHANT_URL ?? "http://localhost:3001"),
  title: { default: "بوابة التجار | تُجّار ماركت", template: "%s | بوابة التجار" },
  description: "أدر متجرك ومنتجاتك على تُجّار ماركت، واستقبل زبائنك مباشرة على واتساب.",
  applicationName: "بوابة تجار تُجّار ماركت",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fbf7f1", width: "device-width", initialScale: 1 };

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell header={<PortalHeader variant="merchant" />} footer={<PortalFooter />}>
      {children}
    </RootShell>
  );
}
