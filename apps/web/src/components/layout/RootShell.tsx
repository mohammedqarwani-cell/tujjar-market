import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { CookieNotice } from "./CookieNotice";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-plex",
});

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** The <html>/<body> frame shared by the buyer site, merchant portal and admin console. */
export function RootShell({
  header,
  footer,
  children,
  bodyClassName = "",
}: {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <html lang="ar" dir="rtl" className={plex.variable}>
      <body className={`flex min-h-dvh flex-col font-sans antialiased ${bodyClassName}`}>
        {DEMO_MODE && (
          <div role="note" className="bg-ink px-4 py-2 text-center text-xs leading-6 text-canvas">
            نسخة تجريبية للعرض: المتاجر والمنتجات وهمية، ورمز التحقق يظهر على الشاشة بدل رسالة SMS. لا تُدخل بيانات حقيقية.
          </div>
        )}
        {header}
        <main className="flex-1">{children}</main>
        {footer}
        <CookieNotice />
      </body>
    </html>
  );
}
