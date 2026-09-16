import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootShell } from "@components/layout/RootShell";
import { PortalFooter, PortalHeader } from "@components/layout/PortalHeader";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002"),
  title: { default: "لوحة الإدارة | تُجّار ماركت", template: "%s | لوحة الإدارة" },
  robots: { index: false, follow: false, nocache: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/brand/icon.svg", type: "image/svg+xml" }],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#1f1a14", width: "device-width", initialScale: 1 };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell header={<PortalHeader variant="admin" />} footer={<PortalFooter />}>
      {children}
    </RootShell>
  );
}
