"use client";

import Link from "next/link";
import { useSession } from "@lib/session";
import { StoreIcon } from "@components/ui/icons";

export function AccountLink() {
  const session = useSession();

  if (session) {
    const href = session.role === "ADMIN" ? "/admin" : "/dashboard";
    return (
      <Link
        href={href}
        className="hidden h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-canvas transition hover:bg-brand-900 sm:flex"
      >
        <StoreIcon size={17} />
        {session.role === "ADMIN" ? "لوحة الإدارة" : "متجري"}
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-1 sm:flex">
      <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-sand">
        دخول
      </Link>
      <Link
        href="/join"
        className="flex h-10 items-center rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
      >
        افتح متجرك مجاناً
      </Link>
    </div>
  );
}
