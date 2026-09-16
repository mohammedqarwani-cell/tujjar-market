import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiGet, toQuery } from "@lib/api";
import type { MarketDetail, Page, ProductCardData, StoreCardData } from "@lib/types";
import { StoreCard } from "@components/catalog/StoreCard";
import { ProductCard } from "@components/catalog/ProductCard";
import { EmptyState, Section } from "@components/ui/Section";
import { PinIcon } from "@components/ui/icons";

type Props = { params: Promise<{ slug: string }> };

async function getMarket(slug: string) {
  try {
    return await apiGet<MarketDetail>(`/markets/${encodeURIComponent(slug)}`, 120);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const market = await getMarket((await params).slug);
  return {
    title: `${market.name} – ${market.governorate.name}`,
    description: market.description ?? `محلات ${market.name} في ${market.governorate.name} ومنتجاتها وأسعارها.`,
  };
}

export default async function MarketPage({ params }: Props) {
  const { slug } = await params;
  const market = await getMarket(slug);
  const [stores, products] = await Promise.all([
    apiGet<Page<StoreCardData>>(`/stores${toQuery({ market: slug, pageSize: 24 })}`),
    apiGet<Page<ProductCardData>>(`/products${toQuery({ market: slug, pageSize: 12 })}`),
  ]);

  return (
    <div className="space-y-10 pb-4">
      <section className="relative overflow-hidden bg-olive-700 text-white">
        <div className="pattern-arches absolute inset-0 opacity-30 invert" />
        <div className="relative mx-auto max-w-6xl px-4 py-10">
          <nav className="text-sm text-olive-100">
            <Link href="/markets" className="hover:text-white">الأسواق</Link>
            <span className="mx-2">/</span>
            <Link href={`/markets#${market.governorate.slug}`} className="hover:text-white">{market.governorate.name}</Link>
          </nav>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{market.name}</h1>
          {market.description && <p className="mt-2 max-w-xl leading-8 text-olive-100">{market.description}</p>}
          <p className="mt-4 flex items-center gap-1.5 text-sm">
            <PinIcon size={16} /> {market.governorate.name} · {market.storesCount} متجر
          </p>
        </div>
      </section>

      <Section title="محلات السوق">
        {stores.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stores.items.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        ) : (
          <EmptyState icon="🏪" title="لا توجد محلات بعد في هذا السوق">
            نضيف محلات هذا السوق تباعاً بعد التحقق منها. تصفّح{" "}
            <Link href="/markets" className="font-medium text-brand-700 underline">باقي الأسواق</Link> حالياً.
          </EmptyState>
        )}
      </Section>

      {products.items.length > 0 && (
        <Section title="منتجات من السوق" href={`/search${toQuery({ market: slug, gov: market.governorate.slug })}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
