import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { apiGet, toQuery } from "@lib/api";
import { GOV_COOKIE } from "@lib/gov";
import { formatNumber } from "@lib/format";
import { webUrl } from "@lib/urls";
import type { Category, Governorate, Page, ProductCardData, StoreCardData } from "@lib/types";
import { ProductCard } from "@components/catalog/ProductCard";
import { StoreCard } from "@components/catalog/StoreCard";
import { EmptyState, Section } from "@components/ui/Section";
import { Pagination } from "@components/ui/Pagination";
import { JsonLd, breadcrumbs } from "@components/seo/JsonLd";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function getCategory(slug: string) {
  const categories = await apiGet<Category[]>("/categories", 300);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return { category, categories };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await getCategory((await params).slug);
  const description = `تسوّق ${category.name} من محلات أسواق سوريا: قارن الأسعار بين ${formatNumber(category.productsCount)} منتج، وتواصل مع التاجر مباشرة على واتساب بدون وسيط.`;
  const url = webUrl(`/categories/${category.slug}`);
  return {
    title: `${category.name} في أسواق سوريا – أسعار ومحلات`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${category.name} | تُجّار ماركت`, description, url, type: "website" },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? sp.page : "";
  const gov = (await cookies()).get(GOV_COOKIE)?.value ?? "";
  const { category, categories } = await getCategory(slug);

  const [products, stores, governorates] = await Promise.all([
    apiGet<Page<ProductCardData>>(`/products${toQuery({ category: slug, gov, page, pageSize: 24, sort: "popular" })}`),
    apiGet<Page<StoreCardData>>(`/stores${toQuery({ category: slug, gov, pageSize: 4 })}`),
    apiGet<Governorate[]>("/governorates", 300),
  ]);
  const govName = governorates.find((g) => g.slug === gov)?.name;
  const place = govName ?? "سوريا";
  const others = categories.filter((c) => c.slug !== slug && c.productsCount > 0).slice(0, 8);

  return (
    <div className="space-y-10 pb-4">
      <JsonLd
        data={[
          breadcrumbs([
            { name: "الرئيسية", url: webUrl("/") },
            { name: category.name, url: webUrl(`/categories/${category.slug}`) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${category.name} في ${place}`,
            numberOfItems: products.total,
            itemListElement: products.items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: webUrl(`/products/${p.id}`), name: p.title })),
          },
        ]}
      />

      <section className="relative overflow-hidden bg-gradient-to-l from-brand-100 via-brand-50 to-olive-50">
        <div className="pattern-arches absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-10">
          <nav className="text-sm text-muted">
            <Link href="/" className="hover:text-ink">الرئيسية</Link>
            <span className="mx-2">/</span>
            <span>الأقسام</span>
          </nav>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <span aria-hidden>{category.icon}</span> {category.name} في {place}
          </h1>
          <p className="mt-3 max-w-2xl leading-8 text-ink/80">
            {formatNumber(products.total)} منتج من محلات {place} في قسم {category.name}. قارن الأسعار بين المتاجر، شوف مستوى توثيق كل محل
            وتقييمات زبائنه، وتواصل مع التاجر مباشرة على واتساب.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Link href={`/search${toQuery({ category: slug, offers: "1", gov })}`} className="rounded-full bg-surface px-4 py-2 font-medium ring-1 ring-line hover:ring-brand-200">
              العروض في {category.name}
            </Link>
            <Link href={`/search${toQuery({ category: slug, sort: "price_asc", gov })}`} className="rounded-full bg-surface px-4 py-2 font-medium ring-1 ring-line hover:ring-brand-200">
              الأرخص أولاً
            </Link>
            <Link href={`/search${toQuery({ type: "stores", category: slug, gov })}`} className="rounded-full bg-surface px-4 py-2 font-medium ring-1 ring-line hover:ring-brand-200">
              كل محلات {category.name}
            </Link>
          </div>
        </div>
      </section>

      {stores.items.length > 0 && (
        <Section title={`محلات ${category.name} الموثوقة`} href={`/search${toQuery({ type: "stores", category: slug, gov })}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stores.items.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        </Section>
      )}

      <Section title={`الأكثر طلباً في ${category.name}`}>
        {products.items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon={category.icon} title="لا توجد منتجات بعد في هذا القسم">
            جرّب «كل سوريا» بدل محافظة محددة، أو تصفّح الأقسام الأخرى.
          </EmptyState>
        )}
        <Pagination basePath={`/categories/${slug}`} params={{}} page={products.page} pages={products.pages} />
      </Section>

      {others.length > 0 && (
        <Section title="أقسام أخرى">
          <div className="flex flex-wrap gap-2">
            {others.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full bg-surface px-4 py-2 text-sm font-medium ring-1 ring-line hover:ring-brand-200">
                {c.icon} {c.name}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
