// apps/web/src/app/(public)/page.tsx
import HomeClient from "./HomeClient";

type SP = Record<string, string | string[] | undefined>;
const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({
  searchParams,
}: {
  // في Next 16: searchParams هي Promise
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const initialCity = pick(sp.city);
  const initialMarket = pick(sp.market);

  return <HomeClient initialCity={initialCity} initialMarket={initialMarket} />;
}
