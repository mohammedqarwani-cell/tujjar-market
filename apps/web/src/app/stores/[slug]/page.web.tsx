import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiGet, toQuery } from "@lib/api";
import { displayPhone, storeLocation } from "@lib/format";
import type { Page, ProductCardData, StoreDetail } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { ProductCard } from "@components/catalog/ProductCard";
import { VerificationBadge } from "@components/catalog/VerificationBadge";
import { ContactButtons } from "@components/contact/ContactButtons";
import { ShareButton } from "@components/contact/ShareButton";
import { ReportButton } from "@components/contact/ReportButton";
import { ViewTracker } from "@components/contact/ViewTracker";
import { EmptyState } from "@components/ui/Section";
import { Pagination } from "@components/ui/Pagination";
import { ClockIcon, PhoneIcon, PinIcon, TruckIcon } from "@components/ui/icons";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function getStore(slug: string) {
  try {
    return await apiGet<StoreDetail>(`/stores/${encodeURIComponent(slug)}`, 60);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getStore((await params).slug);
  const description = s.tagline ?? s.description ?? `متجر ${s.name} في ${storeLocation(s)}`;
  return {
    title: `${s.name} – ${storeLocation(s)}`,
    description,
    openGraph: { title: s.name, description, images: s.coverUrl ?? s.logoUrl ?? undefined },
  };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : "";
  const page = typeof sp.page === "string" ? sp.page : "";

  const [store, products] = await Promise.all([
    getStore(slug),
    apiGet<Page<ProductCardData>>(`/products${toQuery({ store: slug, category, page, pageSize: 24 })}`),
  ]);

  return (
    <div className="pb-24 md:pb-4">
      <ViewTracker storeSlug={store.slug} />

      <div className="relative h-36 overflow-hidden bg-gradient-to-l from-brand-100 via-brand-50 to-olive-100 sm:h-52">
        {store.coverUrl ? (
          <img src={store.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="pattern-arches absolute inset-0" />
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-12 flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card ring-1 ring-line sm:-mt-16 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <StoreAvatar name={store.name} logoUrl={store.logoUrl} className="h-20 w-20 border-4 border-surface text-3xl shadow-sm sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
                <VerificationBadge level={store.verificationLevel} marketName={store.market?.name} />
              </div>
              {store.tagline && <p className="mt-1 text-muted">{store.tagline}</p>}
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink/80">
                <li className="flex items-center gap-1.5">
                  <PinIcon size={16} className="text-brand-600" />
                  {store.market ? (
                    <Link href={`/markets/${store.market.slug}`} className="hover:text-brand-700">{storeLocation(store)}</Link>
                  ) : (
                    storeLocation(store)
                  )}
                </li>
                {store.openingHours && (
                  <li className="flex items-center gap-1.5"><ClockIcon size={16} className="text-brand-600" />{store.openingHours}</li>
                )}
                {store.hasDelivery && (
                  <li className="flex items-center gap-1.5 text-olive-700"><TruckIcon size={16} />يوصّل للزبائن</li>
                )}
                <li className="flex items-center gap-1.5" dir="ltr">
                  <PhoneIcon size={16} className="text-brand-600" />{displayPhone(store.phone ?? store.whatsapp)}
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-80">
            <div className="hidden md:block">
              <ContactButtons store={store} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <ShareButton title={store.name} path={`/stores/${store.slug}`} />
              <ReportButton storeSlug={store.slug} />
            </div>
          </div>
        </div>

        {(store.description || store.address || store.mapUrl) && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {store.description && (
              <p className="rounded-card bg-surface p-5 leading-8 text-ink/85 ring-1 ring-line md:col-span-2">{store.description}</p>
            )}
            {(store.address || store.mapUrl) && (
              <div className="rounded-card bg-surface p-5 ring-1 ring-line">
                <h2 className="text-sm font-bold">العنوان</h2>
                {store.address && <p className="mt-2 text-sm leading-7 text-muted">{store.address}</p>}
                {store.mapUrl && (
                  <a href={store.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                    <PinIcon size={15} /> افتح على الخريطة
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-xl font-bold">منتجات المتجر</h2>
          {store.productCategories.length > 1 && (
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
              <Link
                href={`/stores/${store.slug}`}
                scroll={false}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ${!category ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line"}`}
              >
                الكل
              </Link>
              {store.productCategories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/stores/${store.slug}?category=${c.slug}`}
                  scroll={false}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 ${category === c.slug ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line"}`}
                >
                  {c.icon} {c.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4">
            {products.items.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <EmptyState icon="📦" title="لا توجد منتجات معروضة بعد">
                تواصل مع المتجر مباشرة للسؤال عن المتوفر.
              </EmptyState>
            )}
          </div>
          <Pagination basePath={`/stores/${store.slug}`} params={{ category }} page={products.page} pages={products.pages} />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">
        <ContactButtons store={store} />
      </div>
    </div>
  );
}
