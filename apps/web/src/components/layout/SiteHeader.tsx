// components/layout/SiteHeader.tsx
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import RegionSwitcher from "@components/common/RegionSwitcher";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-full text-sm ${
        active ? "bg-gray-900 text-white" : "hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}

export default function SiteHeader() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL("/search", window.location.origin);
    if (q.trim()) url.searchParams.set("q", q.trim());
    router.push(url.toString());
    setMenuOpen(false);
  }

  const nav = useMemo(
    () => [
      { href: "/", label: "الرئيسية" },
      { href: "/markets", label: "الأسواق" },
      { href: "/stores", label: "المتاجر" },
      { href: "/offers", label: "العروض" },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-3">
        {/* يسار: شعار + روابط دسكتوب */}
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden rounded-lg p-2 border"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <Link href="/" className="font-bold text-lg">
            تُجّار ماركت
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* وسط: البحث */}
        <form
          onSubmit={submitSearch}
          className="hidden md:flex items-center gap-2 min-w-0 flex-1 max-w-xl mx-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن متجر أو منتج…"
            className="w-full rounded-full border px-4 py-2 outline-none"
          />
          <button className="rounded-full px-4 py-2 bg-black text-white">
            ابحث
          </button>
        </form>

        {/* يمين: المنطقة + الدخول/لوحة التاجر + CTA */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex">
            <RegionSwitcher />
          </div>
          <Link
            href="/login"
            className="hidden sm:inline-block px-3 py-2 rounded-full text-sm hover:bg-gray-100"
          >
            دخول
          </Link>
          <Link
            href="/dashboard"
            className="hidden md:inline-block px-3 py-2 rounded-full bg-gray-900 text-white text-sm"
          >
            لوحة التاجر
          </Link>
          <Link
            href="/dashboard/products/new"
            className="px-3 py-2 rounded-full bg-amber-500 text-black text-sm font-semibold"
          >
            افتح متجرك
          </Link>
        </div>
      </div>

      {/* شريط الموبايل المنسدل */}
      {menuOpen && (
        <div className="lg:hidden border-t bg-white">
          <div className="mx-auto max-w-7xl px-4 py-3 space-y-3">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن متجر أو منتج…"
                className="w-full rounded-full border px-4 py-2 outline-none"
              />
              <button className="rounded-full px-4 py-2 bg-black text-white">
                ابحث
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-full text-sm border hover:bg-gray-50"
                >
                  {n.label}
                </Link>
              ))}

              {/* RegionSwitcher للموبايل */}
              <div className="w-full">
                <RegionSwitcher />
              </div>

              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-full text-sm border"
              >
                دخول
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-full text-sm border"
              >
                لوحة التاجر
              </Link>
              <Link
                href="/dashboard/products/new"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-full text-sm bg-amber-500 font-semibold"
              >
                افتح متجرك
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
