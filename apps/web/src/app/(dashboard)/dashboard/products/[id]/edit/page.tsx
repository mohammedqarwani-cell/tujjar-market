"use client";
import { useParamsPromise } from "@lib/params";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = useParamsPromise(params);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [product, setProduct] = useState<any>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/products/${id}`, { cache: "no-store" });
        if (!r.ok) {
          setErr("Product not found");
          setLoading(false);
          return;
        }
        const j = await r.json();
        setProduct(j);
        setName(j.name);
        setPrice(j.price);
        setCategory(j.category);
        setImageUrl(j.imageUrl ?? "");
      } catch {
        setErr("Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function createUploadUrl(contentType: string) {
    const r = await fetch(`${API}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType }),
    });
    return r.json() as Promise<{ uploadUrl: string; publicUrl: string }>;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setErr("Please login");
      setLoading(false);
      return;
    }

    let newImageUrl = imageUrl;
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setErr("Unsupported image type");
        setLoading(false);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErr("Max image size 5MB");
        setLoading(false);
        return;
      }
      const { uploadUrl, publicUrl } = await createUploadUrl(file.type);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setErr("Upload failed");
        setLoading(false);
        return;
      }
      newImageUrl = publicUrl;
    }

    // ✅ استخدم id الذي فككناه؛ لا تستخدم params.id
    const r = await fetch(`${API}/products/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        price: Number(price),
        category,
        imageUrl: newImageUrl || undefined,
      }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.message ?? `Save failed: ${r.status}`);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard/products";
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!product) return <div className="p-6">Not found</div>;

  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-2xl font-bold">Edit Product</h1>
      <form onSubmit={onSave} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Name</span>
          <input
            className="border rounded-lg p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Price</span>
          <input
            className="border rounded-lg p-2"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value as any)}
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Category</span>
          <input
            className="border rounded-lg p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm text-gray-600">Image</span>
          <div className="flex items-center gap-3">
            <div className="size-16 rounded-lg overflow-hidden bg-gray-100">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <input
              className="border rounded-lg p-2 flex-1"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-black text-white">
            Save
          </button>
          <a
            href="/dashboard/products"
            className="px-4 py-2 rounded bg-gray-200"
          >
            Cancel
          </a>
        </div>
      </form>
    </main>
  );
}
