"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, HeartIcon, HomeIcon, SearchIcon, StoreIcon, UserIcon } from "@components/ui/icons";
import { useFavorites } from "@lib/favorites";
import { useCartCount } from "@lib/cart";

const ITEMS = [
  { href: "/", label: "الرئيسية", Icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/markets", label: "الأسواق", Icon: StoreIcon, match: (p: string) => p.startsWith("/markets") },
  { href: "/search", label: "بحث", Icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
  { href: "/cart", label: "السلة", Icon: CartIcon, match: (p: string) => p.startsWith("/cart") },
  { href: "/favorites", label: "المفضلة", Icon: HeartIcon, match: (p: string) => p.startsWith("/favorites") },
  { href: "/account", label: "حسابي", Icon: UserIcon, match: (p: string) => p.startsWith("/account") },
];

export function BottomNav() {
  const pathname = usePathname();
  const favorites = useFavorites().length;
  const cart = useCartCount();

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-6">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`press relative flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${active ? "text-brand-600" : "text-muted"}`}
              >
                <span className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ${active ? "bg-brand-50" : ""}`}>
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                  {href === "/cart" && cart > 0 && (
                    <span className="absolute -top-0.5 end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                      {cart > 99 ? "99+" : cart}
                    </span>
                  )}
                  {href === "/favorites" && favorites > 0 && (
                    <span className="absolute -top-0.5 end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                      {favorites > 99 ? "99+" : favorites}
                    </span>
                  )}
                </span>
                <span className={active ? "font-bold" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
