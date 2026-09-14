import type { Product } from "@services/products.service";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <a
      href={`/product/${p.id}`}
      className="group rounded-2xl bg-white p-3 shadow hover:shadow-md transition block"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
        {p.imageUrl && (
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition"
          />
        )}
      </div>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{p.name}</h3>
          <p className="text-xs text-gray-500">{p.store?.name}</p>
        </div>
        <span className="font-bold">{p.price.toLocaleString()} ل.س</span>
      </div>
    </a>
  );
}
