"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@lib/api";
import { authFetch } from "@lib/session";
import { groupDigits, parseAmount } from "@lib/input";
import type { EditableProduct } from "@lib/merchant";
import type { Category, Condition, Currency, PriceType } from "@lib/types";
import { Field, FormError, Segmented, SubmitButton, Toggle, inputClass, textareaClass } from "@components/forms/fields";
import { ImageUploader } from "./ImageUploader";

type Props = { product?: EditableProduct };

export function ProductForm({ product }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: product?.title ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? "",
    priceType: (product?.priceType ?? "FIXED") as PriceType,
    price: product?.price ? groupDigits(String(product.price)) : "",
    oldPrice: product?.oldPrice ? groupDigits(String(product.oldPrice)) : "",
    currency: (product?.currency ?? "SYP") as Currency,
    condition: (product?.condition ?? "NEW") as Condition,
    inStock: product?.inStock ?? true,
    images: product?.images ?? [],
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setError("تعذّر تحميل الأقسام، أعد تحميل الصفحة"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const onRequest = form.priceType === "ON_REQUEST";
    const price = parseAmount(form.price);
    const oldPrice = parseAmount(form.oldPrice);
    if (form.title.trim().length < 2) return setError("اكتب اسم المنتج");
    if (!form.categoryId) return setError("اختر القسم");
    if (!onRequest && !price) return setError("اكتب السعر، أو اختر «السعر عند الطلب»");
    if (!onRequest && oldPrice && price && oldPrice <= price) {
      return setError("السعر قبل الخصم لازم يكون أعلى من السعر الحالي");
    }

    setPending(true);
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        categoryId: form.categoryId,
        priceType: form.priceType,
        price: onRequest ? null : price,
        oldPrice: onRequest ? null : oldPrice,
        currency: form.currency,
        condition: form.condition,
        inStock: form.inStock,
        images: form.images,
      };
      const saved = await authFetch<{ id: string; status: string }>(
        product ? `/merchant/products/${product.id}` : "/merchant/products",
        { method: product ? "PATCH" : "POST", body },
      );
      const flag = saved.status === "UNDER_REVIEW" ? "review" : product ? "updated" : "created";
      router.push(`/dashboard/products?${flag}=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ");
      setPending(false);
    }
  }

  const currencySuffix = form.currency === "USD" ? "$" : "ل.س";

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">الصور</h2>
        <ImageUploader images={form.images} onChange={(images) => set("images", images)} />
      </section>

      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">المعلومات الأساسية</h2>
        <Field label="اسم المنتج" hint="اكتب الاسم متل ما بيبحث عنه الزبون، مثال: بطارية ليثيوم 100 أمبير">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={inputClass} />
        </Field>
        <Field label="القسم">
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
            <option value="">اختر القسم</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="الوصف" optional hint="المقاسات، الألوان، الكفالة، أي تفصيل بيهم الزبون">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={2000}
            rows={4}
            className={textareaClass}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">السعر</h2>
        <Segmented
          name="priceType"
          value={form.priceType}
          onChange={(v) => set("priceType", v)}
          options={[
            { value: "FIXED", label: "سعر محدد" },
            { value: "NEGOTIABLE", label: "قابل للتفاوض" },
            { value: "ON_REQUEST", label: "عند الطلب" },
          ]}
        />
        {form.priceType !== "ON_REQUEST" && (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="السعر">
                <div className="relative">
                  <input
                    value={form.price}
                    onChange={(e) => set("price", groupDigits(e.target.value))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="0"
                    className={`${inputClass} pe-14 text-left font-bold`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted">{currencySuffix}</span>
                </div>
              </Field>
              <Field label="العملة">
                <Segmented
                  name="currency"
                  value={form.currency}
                  onChange={(v) => set("currency", v)}
                  options={[
                    { value: "SYP", label: "ل.س" },
                    { value: "USD", label: "دولار" },
                  ]}
                />
              </Field>
            </div>
            <Field label="السعر قبل الخصم" optional hint="إذا عبّيته بيظهر المنتج بقسم العروض مع نسبة الخصم">
              <input
                value={form.oldPrice}
                onChange={(e) => set("oldPrice", groupDigits(e.target.value))}
                inputMode="numeric"
                dir="ltr"
                className={`${inputClass} text-left`}
              />
            </Field>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">الحالة</h2>
        <Segmented
          name="condition"
          value={form.condition}
          onChange={(v) => set("condition", v)}
          options={[
            { value: "NEW", label: "جديد" },
            { value: "USED", label: "مستعمل" },
          ]}
        />
        <Toggle
          checked={form.inStock}
          onChange={(v) => set("inStock", v)}
          label="متوفر حالياً"
          description="إذا خلص من عندك، أطفئه بدل ما تحذف المنتج"
        />
      </section>

      <FormError message={error} />
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="flex-1 sm:flex-none">
          {product ? "حفظ التعديلات" : "نشر المنتج"}
        </SubmitButton>
        <button type="button" onClick={() => router.back()} className="h-12 rounded-xl px-5 font-medium text-muted ring-1 ring-line hover:text-ink">
          إلغاء
        </button>
      </div>
    </form>
  );
}
