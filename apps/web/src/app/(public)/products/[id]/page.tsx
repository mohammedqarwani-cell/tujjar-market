import { ProductsService, type Product } from "@services/products.service";

// Next.js 16: params هو Promise
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: Product | null = null;
  try {
    product = await ProductsService.get(id);
  } catch {
    product = null;
  }

  if (!product) {
    return <div className="p-6">Product not found</div>;
  }

  return (
    <main className="mx-auto max-w-4xl p-6 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="text-sm text-gray-500">
          {product.category} • {product.store?.name}
        </div>
        <div className="text-2xl font-extrabold">
          {product.price.toLocaleString()} ل.س
        </div>

        <div className="pt-4">
          {product.store?.slug && (
            <a href={`/stores/${product.store.slug}`} className="underline">
              Visit store
            </a>
          )}
        </div>

        <div className="pt-6">
          <a
            className="px-4 py-2 rounded bg-black text-white"
            href={`tel:+963XXXXXXXXX`}
          >
            Call merchant
          </a>
        </div>
      </div>
    </main>
  );
}
