"use client";

import { use } from "react";
import { useAuthData, type EditableProduct } from "@lib/merchant";
import { ProductForm } from "@components/merchant/ProductForm";
import { FormError } from "@components/forms/fields";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useAuthData<EditableProduct>(`/merchant/products/${id}`);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">تعديل المنتج</h1>
      {data?.status === "UNDER_REVIEW" && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          هذا المنتج قيد مراجعة الإدارة ولن يظهر للزبائن حتى الموافقة عليه.
        </p>
      )}
      <FormError message={error} />
      {loading && !data ? (
        <div className="h-96 animate-pulse rounded-card bg-surface ring-1 ring-line" />
      ) : (
        data && <ProductForm product={data} />
      )}
    </div>
  );
}
