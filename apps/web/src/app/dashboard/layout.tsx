"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, hasToken, useSession } from "@lib/session";
import { BoxIcon, ChartIcon, EyeIcon, LogoutIcon, PlusIcon, SlidersIcon } from "@components/ui/icons";

const NAV = [
  { href: "/dashboard", label: "نظرة عامة", Icon: ChartIcon, exact: true },
  { href: "/dashboard/products", label: "منتجاتي", Icon: BoxIcon, exact: true },
  { href: "/dashboard/products/new", label: "إضافة منتج", Icon: PlusIcon, exact: true },
  { href: "/dashboard/store", label: "إعدادات المتجر", Icon: SlidersIcon, exact: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasToken()) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  useEffect(() => {
    if (session?.role === "ADMIN") router.replace("/admin");
  }, [session, router]);

  if (!session || session.role !== "MERCHANT") {
    return <div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10" aria-busy="true" />;
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:grid md:grid-cols-[14rem_1fr] md:gap-8 md:py-8">
      <aside className="md:sticky md:top-24 md:self-start">
        <div className="hidden rounded-card bg-surface p-4 ring-1 ring-line md:block">
          <div className="text-xs text-muted">متجرك</div>
          <div className="mt-0.5 truncate font-bold">{session.store?.name ?? "—"}</div>
          {session.store && (
            <Link
              href={`/stores/${session.store.slug}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700"
            >
              <EyeIcon size={14} /> عرض كما يراه الزبون
            </Link>
          )}
        </div>

        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:mt-3 md:flex-col md:gap-1 md:px-0">
          {NAV.map(({ href, label, Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-ink text-canvas" : "bg-surface ring-1 ring-line hover:ring-brand-200 md:bg-transparent md:ring-0 md:hover:bg-sand"}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.replace("/");
            }}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-medium text-muted ring-1 ring-line hover:text-danger md:bg-transparent md:ring-0"
          >
            <LogoutIcon size={18} />
            خروج
          </button>
        </nav>
      </aside>

      <section className="mt-4 min-w-0 md:mt-0">{children}</section>
    </div>
  );
}
