import ProductCard from "@components/common/product-card";
import type { Product } from "@services/products.service";

export default function ProductsGrid({ products }: { products: Product[] }) {
  if (!products?.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
        No products
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
