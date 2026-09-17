import { Fragment } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiGet, toQuery } from "@lib/api";
import { GOV_COOKIE } from "@lib/gov";
import { formatNumber } from "@lib/format";
import type { HomeData, HomeLayout, HomeSectionId, ProductCardData } from "@lib/types";
import { ProductCard } from "@components/catalog/ProductCard";
import { StoreCard } from "@components/catalog/StoreCard";
import { Section } from "@components/ui/Section";
import { SearchIcon, ShieldIcon, WhatsAppIcon, PinIcon } from "@components/ui/icons";
import { SearchBox } from "@components/search/SearchBox";
import { PromoCarousel, type Promo } from "@components/home/PromoCarousel";
import { StoreStories } from "@components/home/StoreStories";
import { StoreShowcase } from "@components/home/StoreShowcase";
import { Countdown, Greeting, OpenNowRail, RecentlyViewed } from "@components/home/LiveBits";
import type { Page } from "@lib/types";

const DEFAULT_TITLES: Record<HomeSectionId, string> = {
  banners: "",
  showcase: "متاجر مميزة",
  stories: "",
  categories: "تسوّق حسب القسم",
  offers: "🔥 عروض اليوم",
  openNow: "مفتوح الآن",
  featured: "مختارات من الأسواق",
  markets: "",
  stores: "متاجر موثوقة",
  howItWorks: "",
  recent: "شاهدتها مؤخراً",
  latest: "وصل حديثاً",
};

/** Used until the API sends a layout (e.g. while an older API version is still deployed). */
const FALLBACK_LAYOUT: HomeLayout = {
  sections: (Object.keys(DEFAULT_TITLES) as HomeSectionId[]).map((id) => ({ id, enabled: true, title: "" })),
  autoBanners: true,
  offers: { countdown: "midnight", until: null },
  stories: { showAuto: true },
  quickSearches: ["طاقة شمسية", "موبايلات", "بروكار", "صابون غار", "حلويات", "لابتوب"],
  greeting: true,
};

/** Real product photos from the markets, beside the headline on wide screens. */
function HeroCollage({ products }: { products: ProductCardData[] }) {
  const withPhotos = products.filter((p, i, all) => p.images[0] && all.findIndex((x) => x.id === p.id) === i).slice(0, 4);
  if (withPhotos.length < 4) return null;
  return (
    <div className="relative hidden lg:block" aria-hidden>
      <div className="grid grid-cols-2 gap-4">
        {withPhotos.map((p, i) => (
          <Link
            key={p.id}
            href={`/products/${p.id}`}
            tabIndex={-1}
            className={`group relative overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line ${i % 2 ? "translate-y-8" : ""}`}
          >
            <img src={p.images[0]} alt="" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-2 bottom-2 truncate rounded-xl bg-surface/90 px-3 py-1.5 text-xs font-bold backdrop-blur">
              {p.title}
            </span>
          </Link>
        ))}
      </div>
      <div className="absolute -start-6 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm shadow-card ring-1 ring-line">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-olive-50 text-olive-700">✓</span>
        <span>
          <b className="block">محلات موثّقة</b>
          <span className="text-xs text-muted">تواصل مباشر بلا وسيط</span>
        </span>
      </div>
    </div>
  );
}


export default async function HomePage() {
  const gov = (await cookies()).get(GOV_COOKIE)?.value ?? "";
  const [data, offers] = await Promise.all([
    apiGet<HomeData>(`/home${toQuery({ gov })}`, 60),
    apiGet<Page<ProductCardData>>(`/products${toQuery({ gov, offers: "1", sort: "popular", pageSize: 12 })}`, 60).catch(() => null),
  ]);
  const layout = data.layout ?? FALLBACK_LAYOUT;
  const current = data.governorates.find((g) => g.slug === gov);
  const place = current ? current.name : "سوريا";
  const markets = (current ? [current] : data.governorates)
    .flatMap((g) => g.markets.map((m) => ({ ...m, governorate: g.name })))
    .filter((m) => m.storesCount > 0)
    .slice(0, 10);

  // Stores that added products lately get a story ring
  const fresh = new Set(data.latest.map((p) => p.store.slug));
  const photo = (list: ProductCardData[]) => list.find((p) => p.images[0])?.images[0] ?? null;
  const topCategory = [...data.categories].sort((a, b) => b.productsCount - a.productsCount)[0];
  const teamPromos: Promo[] = (data.banners ?? []).map((b) => ({ id: b.id, href: b.href, eyebrow: b.eyebrow, title: b.title, cta: b.cta, image: b.imageUrl, tone: b.tone }));
  const autoPromos: Promo[] = [
    ...(offers?.total
      ? [{ href: `/search${toQuery({ offers: "1", gov })}`, eyebrow: `${formatNumber(offers.total)} عرض اليوم`, title: "خصومات من محلات السوق", cta: "شوف العروض", image: photo(offers.items), tone: "rose" as const }]
      : []),
    { href: "/search?type=stores&open=1", eyebrow: `${formatNumber(data.totals.stores)} متجر`, title: "محلات مفتوحة هلّق حواليك", cta: "مفتوح الآن", image: data.stores.find((s) => s.coverUrl)?.coverUrl ?? null, tone: "olive" },
    ...(topCategory
      ? [{ href: `/categories/${topCategory.slug}`, eyebrow: `${topCategory.icon} ${topCategory.name}`, title: `الأكثر طلباً في ${place}`, cta: "تسوّق القسم", image: photo(data.featured), tone: "brand" as const }]
      : []),
    { href: "/verification", eyebrow: "اشترِ بثقة", title: "محلات موثّقة بالهوية وفيديو من المحل", cta: "كيف نوثّق", image: photo(data.latest), tone: "ink" },
  ];
  // The team's banners come first; the automatic ones follow unless the team turned them off
  const promos = layout.autoBanners ? [...teamPromos, ...autoPromos] : teamPromos;

  const section = (id: HomeSectionId, title: string) => {
    const name = title || DEFAULT_TITLES[id];
    switch (id) {
      case "banners":
        return (
          promos.length > 0 && (
            <section className="mx-auto max-w-6xl px-4">
              <PromoCarousel promos={promos} />
            </section>
          )
        );
      case "showcase":
        // Wide screens show the showcase inside the hero instead
        return (
          (data.showcase?.length ?? 0) > 0 && (
            <section className="mx-auto max-w-6xl px-4 md:hidden">
              <h2 className="mb-3 text-xl font-bold">{name}</h2>
              <StoreShowcase items={data.showcase} />
            </section>
          )
        );
      case "stories":
        return (
          <section className="mx-auto max-w-6xl px-4 empty:hidden">
            {title && <h2 className="mb-3 text-xl font-bold">{title}</h2>}
            <StoreStories stores={data.stores} fresh={fresh} pinned={data.pinnedStores ?? []} showAuto={layout.stories.showAuto} />
          </section>
        );
      case "categories":
        return (
          <Section title={name} className="reveal">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 lg:grid-cols-8">
              {data.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categories/${c.slug}`}
                  className="press flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl bg-surface p-3 text-center ring-1 ring-line/70 transition hover:-translate-y-0.5 hover:ring-brand-200 sm:w-auto"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="text-xs font-medium leading-5 text-ink">{c.name}</span>
                </Link>
              ))}
            </div>
          </Section>
        );
      case "offers":
        return (
          offers &&
          offers.items.length > 0 && (
            <section className="reveal mx-auto max-w-6xl px-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold sm:text-2xl">{name}</h2>
                  {layout.offers.countdown !== "none" && <Countdown until={layout.offers.countdown === "until" ? layout.offers.until : null} />}
                </div>
                <Link href={`/search${toQuery({ offers: "1", gov })}`} className="text-sm font-medium text-brand-700">
                  الكل ←
                </Link>
              </div>
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                {offers.items.map((p) => (
                  <div key={p.id} className="w-40 shrink-0 snap-start sm:w-52">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          )
        );
      case "openNow":
        return <OpenNowRail stores={data.stores} title={name} />;
      case "featured":
        return (
          data.featured.length > 0 && (
            <Section title={name} subtitle="منتجات مميزة يطلبها الزبائن كثيراً" href={`/search${toQuery({ sort: "popular", gov })}`} className="reveal">
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                {data.featured.map((p) => (
                  <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </Section>
          )
        );
      case "markets":
        return (
          markets.length > 0 && (
            <Section title={title || `أسواق ${place}`} subtitle="ادخل السوق وشوف محلاته من مكانك" href="/markets" linkLabel="كل الأسواق" className="reveal">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {markets.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/markets/${m.slug}`}
                    className="press group relative overflow-hidden rounded-card bg-olive-700 p-4 text-white shadow-card transition hover:-translate-y-0.5"
                  >
                    <div className="pattern-arches absolute inset-0 opacity-40 invert" />
                    <div className="relative">
                      <div className="text-xs text-olive-100">{m.governorate}</div>
                      <div className="mt-1 font-bold">{m.name}</div>
                      <div className="mt-6 text-xs text-olive-100">{m.storesCount} متجر ←</div>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )
        );
      case "stores":
        return (
          data.stores.length > 0 && (
            <Section title={name} subtitle="محلات حقيقية بأرقام تواصل مباشرة" href={`/search${toQuery({ type: "stores", gov })}`} className="reveal">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.stores.map((s) => (
                  <StoreCard key={s.id} store={s} />
                ))}
              </div>
            </Section>
          )
        );
      case "howItWorks":
        return (
          <section className="mx-auto max-w-6xl px-4">
            {title && <h2 className="mb-3 text-xl font-bold sm:text-2xl">{title}</h2>}
            <div className="grid gap-4 rounded-card bg-surface p-6 ring-1 ring-line sm:grid-cols-3 sm:p-8">
              {[
                { Icon: SearchIcon, step: "ابحث وقارن", text: "اكتب اسم الغرض وشوف أسعاره بمحلات مختلفة بمحافظتك." },
                { Icon: WhatsAppIcon, step: "حاكي التاجر", text: "بكبسة زر بتفتح محادثة واتساب مع صاحب المحل مع تفاصيل المنتج." },
                { Icon: ShieldIcon, step: "اشترِ بثقة", text: "متاجر موثّقة، وتقدر تبلّغ عن أي إعلان مخالف فوراً." },
              ].map(({ Icon, step, text }, i) => (
                <div key={step} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon size={24} />
                  </span>
                  <div>
                    <h3 className="font-bold">
                      <span className="text-brand-600">{i + 1}.</span> {step}
                    </h3>
                    <p className="mt-1 text-sm leading-7 text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      case "recent":
        return <RecentlyViewed title={name} />;
      case "latest":
        return (
          data.latest.length > 0 && (
            <Section title={name} href={`/search${toQuery({ gov })}`} className="reveal">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                {data.latest.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </Section>
          )
        );
    }
  };

  return (
    <div className="space-y-8 pb-4 sm:space-y-14">
      {/* Phone: app-style top, greeting and search */}
      <section className="mx-auto max-w-6xl space-y-4 px-4 pt-5 md:hidden">
        {layout.greeting && <Greeting place={place} />}
        <SearchBox variant="page" placeholder="ابحث عن منتج أو متجر…" hidden={gov ? { gov } : {}} />
      </section>

      {/* Hero (wide screens) */}
      <section className="relative hidden overflow-hidden border-b border-line bg-gradient-to-b from-brand-50 to-canvas md:block">
        <div className="pattern-arches absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-10 sm:pb-14 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-xs font-medium text-olive-700 ring-1 ring-olive-100">
              <PinIcon size={14} /> أسواق {place} بين يديك
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-[1.35] text-ink sm:text-5xl sm:leading-[1.25]">
              لاقِ غرضك بأقرب سوق،
              <span className="text-brand-600"> وحاكي التاجر مباشرة</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted sm:text-lg">
              قارن الأسعار بين محلات الحميدية وسوق المدينة وغيرها، وتواصل مع صاحب المحل على واتساب — بدون وسيط
              وبدون عمولة.
            </p>

            <SearchBox variant="hero" placeholder="شو بدك تشتري اليوم؟ جرّب: شي يشحن الموبايل بلا كهربا" hidden={gov ? { gov } : {}} />

            {layout.quickSearches.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">الأكثر بحثاً:</span>
                {layout.quickSearches.map((q) => (
                  <Link
                    key={q}
                    href={`/search${toQuery({ q, gov })}`}
                    className="rounded-full bg-surface px-3 py-1 text-ink ring-1 ring-line transition hover:ring-brand-200"
                  >
                    {q}
                  </Link>
                ))}
              </div>
            )}

            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                [data.totals.stores, "متجر"],
                [data.totals.products, "منتج"],
                [data.totals.markets, "سوق"],
              ].map(([n, label]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-bold text-ink">{formatNumber(n as number)}</dd>
                  <span className="text-muted">{label}</span>
                </div>
              ))}
            </dl>
          </div>
          {data.showcase?.length ? (
            <StoreShowcase items={data.showcase} className="hidden lg:block" />
          ) : (
            <HeroCollage products={[...data.featured, ...data.latest]} />
          )}
        </div>
      </section>

      {layout.sections
        .filter((s) => s.enabled)
        .map((s) => (
          <Fragment key={s.id}>{section(s.id, s.title)}</Fragment>
        ))}
    </div>
  );
}
