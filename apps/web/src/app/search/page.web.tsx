import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiGet, toQuery } from "@lib/api";
import { GOV_COOKIE } from "@lib/gov";
import { formatNumber } from "@lib/format";
import type { Category, Governorate, Page, ProductCardData, StoreCardData } from "@lib/types";
import { ProductCard } from "@components/catalog/ProductCard";
import { StoreCard } from "@components/catalog/StoreCard";
import { EmptyState } from "@components/ui/Section";
import { Pagination } from "@components/ui/Pagination";
import { SearchIcon } from "@components/ui/icons";
import { SearchControls } from "./SearchControls";
import { SearchBox } from "@components/search/SearchBox";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const q = one((await searchParams).q);
  return { title: q ? `نتائج «${q}»` : "ابحث في الأسواق", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const cookieGov = (await cookies()).get(GOV_COOKIE)?.value ?? "";
  const params = {
    q: one(sp.q),
    type: one(sp.type) === "stores" ? "stores" : "",
    category: one(sp.category),
    gov: "gov" in sp ? one(sp.gov) : cookieGov,
    market: one(sp.market),
    sort: one(sp.sort),
    condition: one(sp.condition),
    offers: one(sp.offers),
    open: one(sp.open),
    page: one(sp.page),
  };
  const isStores = params.type === "stores";

  const [categories, governorates, results] = await Promise.all([
    apiGet<Category[]>("/categories", 300),
    apiGet<Governorate[]>("/governorates", 300),
    isStores
      ? apiGet<Page<StoreCardData>>(
          `/stores${toQuery({ q: params.q, gov: params.gov, market: params.market, category: params.category, open: params.open, page: params.page, pageSize: 24 })}`,
        )
      : apiGet<Page<ProductCardData>>(
          `/products${toQuery({ ...params, type: undefined, pageSize: 24 })}`,
        ),
  ]);

  const category = categories.find((c) => c.slug === params.category);
  const gov = governorates.find((g) => g.slug === params.gov);
  const heading = params.q
    ? `نتائج «${params.q}»`
    : params.offers
      ? "العروض والتخفيضات"
      : category
        ? `${category.icon} ${category.name}`
        : isStores
          ? "المتاجر"
          : "كل المنتجات";

  const tabHref = (type: string) => `/search${toQuery({ ...params, type: type || undefined, page: undefined, sort: undefined, condition: undefined, offers: undefined })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <SearchBox key={params.q} variant="page" defaultValue={params.q} hidden={isStores ? { type: "stores" } : {}} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(results.total)} {isStores ? "متجر" : "منتج"}
            {gov ? ` في ${gov.name}` : " في كل سوريا"}
          </p>
        </div>
        <div className="flex rounded-full bg-sand p-1 text-sm font-medium">
          <Link href={tabHref("")} className={`rounded-full px-4 py-1.5 ${!isStores ? "bg-surface shadow-sm" : "text-muted"}`}>
            منتجات
          </Link>
          <Link href={tabHref("stores")} className={`rounded-full px-4 py-1.5 ${isStores ? "bg-surface shadow-sm" : "text-muted"}`}>
            متاجر
          </Link>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link
          href={`/search${toQuery({ ...params, category: undefined, page: undefined })}`}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ${!category ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line hover:ring-brand-200"}`}
        >
          كل الأقسام
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/search${toQuery({ ...params, category: c.slug, page: undefined })}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ${c.slug === params.category ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line hover:ring-brand-200"}`}
          >
            <span aria-hidden>{c.icon}</span> {c.name}
          </Link>
        ))}
      </div>

      {results.search && (results.search.correctedQuery || results.search.alsoSearched.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm ring-1 ring-brand-100">
          <SearchIcon size={16} className="shrink-0 text-brand-700" />
          {results.search.correctedQuery && (
            <span>
              هل تقصد{" "}
              <Link href={`/search${toQuery({ ...params, q: results.search.correctedQuery, page: undefined })}`} className="font-bold text-brand-700 underline">
                {results.search.correctedQuery}
              </Link>
              ؟ عرضنا لك نتائجها.
            </span>
          )}
          {results.search.alsoSearched.length > 0 && (
            <span className="text-ink/80">
              بحثنا أيضاً عن: <span className="font-medium">{results.search.alsoSearched.join("، ")}</span>
            </span>
          )}
        </div>
      )}

      <SearchControls
        params={params}
        isStores={isStores}
        governorates={governorates
          .filter((g) => g.status !== "COMING_SOON")
          .map((g) => ({ slug: g.slug, name: g.name, markets: g.markets }))}
      />

      <div className="mt-6">
        {results.items.length === 0 ? (
          <EmptyState title="ما لقينا نتائج مطابقة">
            جرّب كلمة أبسط، أو اختر «كل سوريا» بدل محافظة محددة، أو امسح الفلاتر.
            <div className="mt-4">
              <Link href="/search" className="font-medium text-brand-700 underline">مسح كل الفلاتر</Link>
            </div>
          </EmptyState>
        ) : isStores ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(results.items as StoreCardData[]).map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {(results.items as ProductCardData[]).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      <Pagination basePath="/search" params={params} page={results.page} pages={results.pages} />
    </div>
  );
}
