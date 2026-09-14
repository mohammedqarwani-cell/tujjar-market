import { StoresService } from "@services/stores.service";
import ProductsGrid from "@features/catalog/components/products-grid";
import { useParamsPromise } from "@lib/params";

export const metadata = { title: "Store – Tujjar Market" };

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await StoresService.bySlug(slug).catch(() => null);
  if (!store) return <div className="p-6">Store not found</div>;

  // منتجات المتجر (صفحة أولى فقط للعرض)
  const prods = await StoresService.productsByStore(slug, 1, 24).catch(() => ({
    items: [],
  }));

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center gap-4">
        <div className="size-16 rounded-full overflow-hidden bg-gray-100">
          {store.imageUrl && (
            <img
              src={store.imageUrl}
              alt={store.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <div className="text-sm text-gray-500">
            {store.city} • {store.market}
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-2">Products</h2>
        <ProductsGrid products={prods.items as any} />
      </section>
    </main>
  );
}
