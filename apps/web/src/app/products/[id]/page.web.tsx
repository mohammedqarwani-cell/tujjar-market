import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiGet } from "@lib/api";
import { discountPercent, formatNumber, priceLabel, storeLocation, timeAgo } from "@lib/format";
import type { ProductDetail } from "@lib/types";
import { PriceTag } from "@components/catalog/PriceTag";
import { ProductCard } from "@components/catalog/ProductCard";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { FavoriteButton } from "@components/catalog/FavoriteButton";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { ContactButtons } from "@components/contact/ContactButtons";
import { ShareButton } from "@components/contact/ShareButton";
import { ReportButton } from "@components/contact/ReportButton";
import { ViewTracker } from "@components/contact/ViewTracker";
import { RememberViewed } from "@components/home/LiveBits";
import { Section } from "@components/ui/Section";
import { ClockIcon, EyeIcon, PinIcon, ShieldIcon, TruckIcon } from "@components/ui/icons";
import { ProductGallery } from "./ProductGallery";
import { JsonLd, breadcrumbs } from "@components/seo/JsonLd";
import { webUrl } from "@lib/urls";

type Props = { params: Promise<{ id: string }> };

async function getProduct(id: string) {
  try {
    return await apiGet<ProductDetail>(`/products/${encodeURIComponent(id)}`, 60);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).id);
  const price = priceLabel(p).main;
  const description = `${price} · ${p.store.name}، ${storeLocation(p.store)}. ${p.description ?? ""}`.trim();
  return {
    title: p.title,
    description,
    openGraph: { title: `${p.title} – ${price}`, description, images: p.images[0] ? [p.images[0]] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const p = await getProduct((await params).id);
  const discount = discountPercent(p.price, p.oldPrice);
  const priceText = priceLabel(p).main;
  const { similar, fromStore, ...card } = p;

  return (
    <div className="pb-28 md:pb-4">
      <ViewTracker productId={p.id} />
      <RememberViewed product={card} />
      <JsonLd
        data={[
          breadcrumbs([
            { name: "الرئيسية", url: webUrl("/") },
            { name: p.category.name, url: webUrl(`/categories/${p.category.slug}`) },
            { name: p.title, url: webUrl(`/products/${p.id}`) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.title,
            description: p.description ?? undefined,
            image: p.images.length ? p.images : undefined,
            category: p.category.name,
            itemCondition: p.condition === "NEW" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
            ...(p.price != null && p.priceType !== "ON_REQUEST"
              ? {
                  offers: {
                    "@type": "Offer",
                    price: p.price,
                    priceCurrency: p.currency,
                    availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                    url: webUrl(`/products/${p.id}`),
                    seller: { "@type": "Store", name: p.store.name, url: webUrl(`/stores/${p.store.slug}`) },
                  },
                }
              : {}),
          },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/" className="hover:text-ink">الرئيسية</Link>
          <span>/</span>
          <Link href={`/categories/${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link>
          <span>/</span>
          <Link href={`/stores/${p.store.slug}`} className="hover:text-ink">{p.store.name}</Link>
        </nav>

        {/* min-w-0: grid items may shrink below their content, so photos or long text never widen the page */}
        <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10 [&>*]:min-w-0">
          <div className="relative">
            <ProductGallery images={p.images} title={p.title} icon={p.category.icon} seed={p.category.slug} />
            <FavoriteButton product={card} className="absolute end-3 top-3" />
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap gap-2">
                {discount > 0 && <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-bold text-white">خصم {discount}٪</span>}
                <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium">{p.condition === "USED" ? "مستعمل" : "جديد"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.inStock ? "bg-olive-50 text-olive-700" : "bg-danger/10 text-danger"}`}>
                  {p.inStock ? "متوفر" : "غير متوفر حالياً"}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{p.title}</h1>
              <div className="mt-4">
                <PriceTag price={p.price} oldPrice={p.oldPrice} currency={p.currency} priceType={p.priceType} size="lg" />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1"><ClockIcon size={14} />أضيف {timeAgo(p.createdAt)}</span>
                <span className="flex items-center gap-1"><EyeIcon size={14} />{formatNumber(p.viewsCount)} مشاهدة</span>
              </p>
            </div>

            <div className="hidden md:block">
              <ContactButtons store={p.store} product={{ id: p.id, title: p.title, priceText }} />
            </div>

            {p.description && (
              <div className="rounded-card bg-surface p-5 ring-1 ring-line">
                <h2 className="text-sm font-bold">التفاصيل</h2>
                <p className="mt-2 whitespace-pre-line leading-8 text-ink/85">{p.description}</p>
              </div>
            )}

            <Link
              href={`/stores/${p.store.slug}`}
              className="flex items-center gap-4 rounded-card bg-surface p-4 ring-1 ring-line transition hover:ring-brand-200"
            >
              <StoreAvatar name={p.store.name} logoUrl={p.store.logoUrl} className="h-14 w-14 text-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-bold">{p.store.name}</span>
                  <VerifiedMark level={p.store.verificationLevel} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="flex items-center gap-1"><PinIcon size={13} />{storeLocation(p.store)}</span>
                  {p.store.hasDelivery && <span className="flex items-center gap-1 text-olive-700"><TruckIcon size={13} />توصيل</span>}
                </div>
              </div>
              <span className="text-sm font-medium text-brand-700">زيارة المتجر ←</span>
            </Link>

            <div className="flex items-start gap-3 rounded-card bg-brand-50 p-4 text-sm leading-7 text-brand-900">
              <ShieldIcon size={22} className="mt-1 shrink-0 text-brand-600" />
              <div>
                <strong>نصائح للشراء الآمن:</strong> عاين المنتج قبل الدفع، واتفق على السعر والتوصيل بوضوح، ولا
                تحوّل مبالغ مسبقة لتاجر لا تعرفه.
              </div>
            </div>

            <div className="flex items-center justify-between">
              <ShareButton title={p.title} path={`/products/${p.id}`} />
              <ReportButton productId={p.id} />
            </div>
          </div>
        </div>
      </div>

      {fromStore.length > 0 && (
        <Section title={`المزيد من ${p.store.name}`} href={`/stores/${p.store.slug}`} className="mt-6">
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {fromStore.map((x) => (
              <div key={x.id} className="w-44 shrink-0 snap-start sm:w-52"><ProductCard product={x} /></div>
            ))}
          </div>
        </Section>
      )}

      {similar.length > 0 && (
        <Section title="منتجات مشابهة من محلات أخرى" subtitle="قارن الأسعار قبل ما تشتري" href={`/search?category=${p.category.slug}`} className="mt-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {similar.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">
        <ContactButtons store={p.store} product={{ id: p.id, title: p.title, priceText }} />
      </div>
    </div>
  );
}
