"use client";

import Link from "next/link";
import { useSession } from "@lib/session";
import { UserIcon } from "@components/ui/icons";
import { merchantUrl } from "@lib/urls";

export function AccountLink() {
  const buyer = useSession("web", { lazy: true });

  return (
    <div className="hidden items-center gap-1 sm:flex">
      {buyer.user ? (
        <Link href="/account" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium hover:bg-sand">
          <UserIcon size={17} /> {buyer.user.name.split(" ")[0]}
        </Link>
      ) : (
        <Link href="/account/login" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-sand">
          دخول
        </Link>
      )}
      <a
        href={merchantUrl("/join")}
        className="flex h-10 items-center rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
      >
        افتح متجرك مجاناً
      </a>
    </div>
  );
}
