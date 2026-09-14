"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@components/common/TopBar";
import { Tabs } from "@components/ui/Tabs";
import ChipScroll from "@components/ui/ChipScroll";

type Store = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  market?: string | null;
  imageUrl?: string | null;
};
type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  store?: { slug?: string | null } | null;
};
type MarketMeta = { name: string; count: number };

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);
const apiUrl = (path: string) => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${clean}` : clean;
};

export default function HomeClient({
  initialCity = "",
  initialMarket = "",
}: {
  initialCity?: string;
  initialMarket?: string;
}) {
  const router = useRouter();

  // تحديث الاستعلام دون ريفريش
  const replaceSearchIfChanged = (
    nextParams: Record<string, string | undefined>
  ) => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    Object.entries(nextParams).forEach(([k, v]) => {
      if (v && v.length) sp.set(k, v);
      else sp.delete(k);
    });
    const next = `?${sp.toString()}`;
    if (next !== window.location.search)
      router.replace(next, { scroll: false });
  };

  // حالة المدينة/السوق
  const [mounted, setMounted] = useState(false);
  const [city, setCity] = useState(initialCity);
  const [market, setMarket] = useState(initialMarket);

  // عنوان ديناميكي آمن
  const title = useMemo(() => {
    if (!mounted)
      return initialCity ? ` أسواق ${initialCity}` : "اختر مدينة لعرض الأسواق";
    return city ? ` أسواق ${city} ` : "اختر مدينة لعرض الأسواق";
  }, [mounted, initialCity, city]);

  // أخطاء واجهة
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  // بحث سريع للتوجّه إلى /products
  const [quickQ, setQuickQ] = useState("");
  const goToProducts = (e?: FormEvent) => {
    e?.preventDefault?.();
    const sp = new URLSearchParams({
      ...(quickQ ? { q: quickQ } : {}),
      ...(city ? { city } : {}),
      ...(market ? { market } : {}),
    });
    router.push(`/products?${sp.toString()}`);
  };

  // mount + الاستماع لتغيّر المنطقة
  useEffect(() => {
    setMounted(true);
    const onRegionChange = () => {
      try {
        const saved = localStorage.getItem("user_region");
        if (!saved) return;
        const r = JSON.parse(saved);
        const nextCity: string = r?.city || "";
        setCity(nextCity);
        setMarket("");
        replaceSearchIfChanged({
          city: nextCity || undefined,
          market: undefined,
        });
      } catch {}
    };
    window.addEventListener("region-change", onRegionChange);
    return () => window.removeEventListener("region-change", onRegionChange);
  }, []);

  // استنتاج المدينة: localStorage ثم Geolocation
  useEffect(() => {
    if (initialCity) return;

    try {
      const saved = localStorage.getItem("user_region");
      if (saved) {
        const r = JSON.parse(saved);
        if (r?.city) {
          setCity(r.city);
          setMarket("");
          replaceSearchIfChanged({ city: r.city, market: undefined });
          return;
        }
      }
    } catch {}

    const askPermission = async () => {
      const confirmed = window.confirm(
        "هل ترغب في السماح للتطبيق باستخدام موقعك لتحديد مدينتك تلقائيًا؟"
      );
      if (!confirmed) return;

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const r = await fetch(
                apiUrl(`regions/resolve?lat=${latitude}&lng=${longitude}`),
                {
                  cache: "no-store",
                }
              );
              const j = await r.json();
              if (j?.city?.name) {
                const detectedCity = String(j.city.name);
                setCity(detectedCity);
                setMarket("");
                localStorage.setItem(
                  "user_region",
                  JSON.stringify({
                    country: j.region?.code || "",
                    city: detectedCity,
                  })
                );
                replaceSearchIfChanged({
                  city: detectedCity,
                  market: undefined,
                });
                window.dispatchEvent(new Event("region-change"));
              }
            } catch {}
          },
          () => alert("لم يتم السماح بالوصول إلى الموقع."),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
        );
      } else {
        alert("خاصية تحديد الموقع غير مدعومة في هذا المتصفح.");
      }
    };

    askPermission();
  }, [initialCity]);

  // أسواق المدينة
  const [markets, setMarkets] = useState<MarketMeta[]>([]);
  useEffect(() => {
    if (!city) {
      setMarkets([]);
      setMarketsError(null);
      return;
    }
    const ctrl = new AbortController();
    setMarketsError(null);
    (async () => {
      try {
        const r = await fetch(
          apiUrl(`regions/markets?city=${encodeURIComponent(city)}`),
          {
            signal: ctrl.signal,
            cache: "no-store",
          }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const m: MarketMeta[] = await r.json();
        setMarkets(Array.isArray(m) ? m.filter((x) => x && x.name) : []);
      } catch (e) {
        setMarkets([]);
        setMarketsError("تعذر تحميل الأسواق.");
      }
    })();
    return () => ctrl.abort();
  }, [city]);

  // المتاجر
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const loadStores = () => {
    const ctrl = new AbortController();
    setStoresError(null);
    const qs = new URLSearchParams({
      limit: "24",
      hasImageOnly: "true",
      ...(city ? { city } : {}),
      ...(market ? { market } : {}),
    });
    setLoadingStores(true);
    fetch(apiUrl(`stores?${qs.toString()}`), {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => {
        setStores([]);
        setStoresError("تعذر تحميل المتاجر.");
      })
      .finally(() => setLoadingStores(false));
    return () => ctrl.abort();
  };
  useEffect(() => {
    const abort = loadStores();
    return () => {
      if (typeof abort === "function") (abort as any)();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, market]);

  // المنتجات (شبّاك مصغّر)
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const loadProducts = () => {
    const ctrl = new AbortController();
    setProductsError(null);
    const qs = new URLSearchParams({
      page: "1",
      pageSize: "24",
      ...(city ? { city } : {}),
      ...(market ? { market } : {}),
    });
    setLoadingProducts(true);
    fetch(apiUrl(`products?${qs.toString()}`), {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => setProducts(Array.isArray(j?.items) ? j.items : []))
      .catch(() => {
        setProducts([]);
        setProductsError("تعذر تحميل المنتجات.");
      })
      .finally(() => setLoadingProducts(false));
    return () => ctrl.abort();
  };
  useEffect(() => {
    const abort = loadProducts();
    return () => {
      if (typeof abort === "function") (abort as any)();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, market]);

  // تبويب المتاجر
  const StoresTab = (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {market
            ? ` متاجر سوق ${market} `
            : city
            ? ` متاجر ${city} `
            : "متاجر مميزة"}
        </h3>
        <button
          onClick={loadStores as any}
          className="text-sm underline text-sky-600"
        >
          تحديث
        </button>
      </div>

      {storesError && <ErrorBanner text={storesError} />}

      {loadingStores ? (
        <SkeletonStores />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {stores.map((s) => (
            <a
              key={s.id}
              href={`/stores/${s.slug}`}
              className="rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
            >
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
                {s.imageUrl && (
                  <img
                    src={s.imageUrl}
                    alt={s.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="mt-3">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {s.city}
                  {s.market ? ` • ${s.market}` : ""}
                </div>
              </div>
            </a>
          ))}
          {stores.length === 0 && !storesError && (
            <div className="col-span-full rounded-xl border bg-white p-6 text-center text-gray-500">
              لا توجد متاجر مطابقة.
            </div>
          )}
        </div>
      )}
    </section>
  );

  // تبويب المنتجات
  const ProductsTab = (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {market
            ? ` منتجات سوق ${market}`
            : city
            ? ` منتجات ${city}`
            : "منتجات حديثة"}
        </h3>
        <div className="flex items-center gap-3">
          <a
            href={`/products?${new URLSearchParams({
              ...(city ? { city } : {}),
              ...(market ? { market } : {}),
            }).toString()}`}
            className="text-sm rounded-lg border px-3 py-1 hover:bg-gray-50"
          >
            عرض كل المنتجات
          </a>
          <button
            onClick={loadProducts as any}
            className="text-sm underline text-sky-600"
          >
            تحديث
          </button>
        </div>
      </div>

      {productsError && <ErrorBanner text={productsError} />}

      {loadingProducts ? (
        <SkeletonProducts />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <a
              key={p.id}
              href={p.store?.slug ? `/stores/${p.store.slug}` : "#"}
              className="rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="mt-3">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {p.category}
                </div>
                <div className="mt-1 font-bold">
                  {Number.isFinite(p.price)
                    ? Number(p.price).toLocaleString()
                    : p.price}{" "}
                  ل.س
                </div>
              </div>
            </a>
          ))}
          {products.length === 0 && !productsError && (
            <div className="col-span-full rounded-xl border bg-white p-6 text-center text-gray-500">
              لا توجد منتجات مطابقة.
            </div>
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-dvh bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* <TopBar /> */}
        <header className="space-y-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">الصفحة الرئيسية</h1>
              <p className="text-gray-500">مرحبًا بك في تطبيق تُجّار ماركت</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/products?${new URLSearchParams({
                  ...(city ? { city } : {}),
                  ...(market ? { market } : {}),
                }).toString()}`}
                className="rounded-xl bg-black text-white px-4 py-2"
              >
                استكشف المنتجات
              </a>
            </div>
          </div>

          {/* فورم البحث السريع للمنتجات */}
          <form onSubmit={goToProducts} className="mt-3 flex gap-2">
            <input
              value={quickQ}
              onChange={(e) => setQuickQ(e.target.value)}
              placeholder="ابحث بسرعة عن منتج…"
              className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring"
            />
            <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">
              بحث
            </button>
          </form>
        </header>

        <h2 className="text-lg font-semibold" suppressHydrationWarning>
          {title}
        </h2>

        {marketsError && <ErrorBanner text={marketsError} />}

        {/* دوائر الأسواق */}
        {city && markets.length > 0 && !marketsError && (
          <ChipScroll
            title="اختر سوقًا بسرعة"
            items={markets.map((m) => ({ label: m.name, count: m.count }))}
            onSelect={(label: string) => {
              if (label === market) return;
              setMarket(label);
              replaceSearchIfChanged({
                city: city || undefined,
                market: label,
              });
            }}
          />
        )}

        <Tabs
          tabs={[
            { label: "متاجر", content: StoresTab },
            { label: "منتجات", content: ProductsTab },
          ]}
          initial={0}
        />
      </main>
    </div>
  );
}

/* === UI helpers === */
function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {text}
    </div>
  );
}

/* === Skeletons === */
function SkeletonStores() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white p-3 shadow">
          <div className="aspect-[4/3] w-full bg-gray-200 rounded-xl animate-pulse" />
          <div className="mt-3 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}
function SkeletonProducts() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white p-3 shadow">
          <div className="aspect-square w-full bg-gray-200 rounded-xl animate-pulse" />
          <div className="mt-3 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}
