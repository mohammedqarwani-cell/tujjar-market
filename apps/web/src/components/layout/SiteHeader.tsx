import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@components/brand/Logo";
import { apiGet } from "@lib/api";
import { GOV_COOKIE } from "@lib/gov";
import type { Governorate } from "@lib/types";
import { GovernoratePicker } from "./GovernoratePicker";
import { AccountLink } from "./AccountLink";
import { GovernorateLocator } from "./GovernorateLocator";
import { NotificationBell } from "@components/notifications/NotificationBell";
import { SearchBox } from "@components/search/SearchBox";

export async function SiteHeader() {
  const [governorates, current] = await Promise.all([
    apiGet<Governorate[]>("/governorates", 300).catch(() => [] as Governorate[]),
    cookies().then((c) => c.get(GOV_COOKIE)?.value ?? ""),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="تُجّار ماركت – الرئيسية" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          <Link href="/markets" className="rounded-full px-3 py-2 hover:bg-sand">الأسواق</Link>
          <Link href="/search?type=stores" className="rounded-full px-3 py-2 hover:bg-sand">المتاجر</Link>
          <Link href="/search?offers=1" className="rounded-full px-3 py-2 hover:bg-sand">العروض</Link>
        </nav>

        <SearchBox variant="header" />

        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <GovernoratePicker
            governorates={governorates.filter((g) => g.status !== "COMING_SOON").map(({ slug, name }) => ({ slug, name }))}
            current={current}
          />
          <GovernorateLocator
            governorates={governorates.map(({ slug, name, status, latitude, longitude }) => ({ slug, name, status, latitude, longitude }))}
            current={current}
          />
          <NotificationBell audience="web" />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
