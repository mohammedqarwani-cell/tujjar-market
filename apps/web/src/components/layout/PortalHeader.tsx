import Link from "next/link";
import { Logo } from "@components/brand/Logo";
import { ShieldIcon, StoreIcon } from "@components/ui/icons";
import { webUrl } from "@lib/urls";
import { NotificationBell } from "@components/notifications/NotificationBell";

/** Header for the merchant portal and the admin console (no buyer navigation or search). */
export function PortalHeader({ variant }: { variant: "merchant" | "admin" }) {
  const isAdmin = variant === "admin";
  return (
    <header className={`sticky top-0 z-40 border-b ${isAdmin ? "border-ink bg-ink text-canvas" : "border-line/80 bg-canvas/90 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <Link href={isAdmin ? "/admin" : "/dashboard"} aria-label="الصفحة الرئيسية للبوابة" className={isAdmin ? "[&_span]:text-canvas" : ""}>
            <Logo compact />
          </Link>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isAdmin ? "bg-canvas/15 text-canvas" : "bg-olive-50 text-olive-700 ring-1 ring-olive-100"}`}
          >
            {isAdmin ? <ShieldIcon size={14} /> : <StoreIcon size={14} />}
            {isAdmin ? "لوحة الإدارة" : "بوابة التجار"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell audience={variant} tone={isAdmin ? "dark" : "light"} />
          {!isAdmin && (
            <a href={webUrl("/")} className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-sand hover:text-ink sm:block">
              الذهاب إلى الموقع ←
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="mt-12 border-t border-line/70 py-5 text-center text-xs text-muted">
      <span>© {new Date().getFullYear()} تُجّار ماركت</span>
      <span className="mx-3">·</span>
      <Link href="/terms" className="hover:text-ink">الشروط والأحكام</Link>
      <span className="mx-3">·</span>
      <Link href="/privacy" className="hover:text-ink">سياسة الخصوصية</Link>
    </footer>
  );
}
