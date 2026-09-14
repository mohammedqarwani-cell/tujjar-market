"use client";
import { useState } from "react";
import { ProductsService } from "@services/products.service";
import { ENV } from "@lib/env";

export default function NewProductPage() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [storeId, setStoreId] = useState(""); // إن كان عندك متجر واحد املأه تلقائياً
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function getUploadUrl(contentType: string) {
    const r = await fetch(`${ENV.API_BASE_URL}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType }),
    });
    if (!r.ok) throw new Error("Failed to get upload URL");
    return r.json() as Promise<{ uploadUrl: string; publicUrl: string }>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      let imageUrl: string | undefined = undefined;
      if (file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error("Unsupported image type");
        const { uploadUrl, publicUrl } = await getUploadUrl(file.type);
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("Upload failed");
        imageUrl = publicUrl;
      }
      const dto = { name, price: Number(price), category, storeId, imageUrl };
      await ProductsService.create(dto);
      window.location.href = "/dashboard/products";
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Add Product</h2>
      <form onSubmit={onSubmit} className="grid gap-3 max-w-lg">
        <input
          className="border rounded-lg p-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border rounded-lg p-2"
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value as any)}
          required
        />
        <input
          className="border rounded-lg p-2"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />
        <input
          className="border rounded-lg p-2"
          placeholder="Store ID"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          required
        />
        <input
          className="border rounded-lg p-2"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {err && <div className="text-red-600">{err}</div>}
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded bg-black text-white"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <a
            href="/dashboard/products"
            className="px-4 py-2 rounded bg-gray-200"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
