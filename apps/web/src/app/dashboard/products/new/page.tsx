"use client";

import { ProductForm } from "@components/merchant/ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">إضافة منتج</h1>
      <ProductForm />
    </div>
  );
}
