import { IBM_Plex_Sans_Arabic } from "next/font/google";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-plex",
});

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
        {header}
        <main className="flex-1">{children}</main>
        {footer}
      </body>
    </html>
  );
}
