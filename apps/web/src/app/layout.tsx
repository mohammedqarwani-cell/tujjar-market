// apps/web/src/app/layout.tsx
import SiteFooter from "@components/layout/SiteFooter";
import "./globals.css";
import GeoBootstrap from "@components/system/GeoBootstrap";
import SiteHeader from "@components/layout/SiteHeader";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SiteHeader />
        <GeoBootstrap />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
