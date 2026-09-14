"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartIcon, HomeIcon, SearchIcon, StoreIcon, UserIcon } from "@components/ui/icons";
import { useSession } from "@lib/session";

export function BottomNav() {
  const pathname = usePathname();
  const session = useSession();
  const accountHref = session ? (session.role === "ADMIN" ? "/admin" : "/dashboard") : "/join";

  const items = [
    { href: "/", label: "الرئيسية", Icon: HomeIcon, match: (p: string) => p === "/" },
    { href: "/markets", label: "الأسواق", Icon: StoreIcon, match: (p: string) => p.startsWith("/markets") },
    { href: "/search", label: "بحث", Icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
    { href: "/favorites", label: "المفضلة", Icon: HeartIcon, match: (p: string) => p.startsWith("/favorites") },
    {
      href: accountHref,
      label: session ? "متجري" : "افتح متجرك",
      Icon: UserIcon,
      match: (p: string) => ["/dashboard", "/admin", "/join", "/login"].some((x) => p.startsWith(x)),
    },
  ];

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${active ? "text-brand-600" : "text-muted"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
