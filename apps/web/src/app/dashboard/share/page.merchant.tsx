"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@lib/session";
import { useAuthData, type MerchantProduct } from "@lib/merchant";
import { webUrl } from "@lib/urls";
import { whatsappLink } from "@lib/contact";
import { priceLabel } from "@lib/format";
import type { Page } from "@lib/types";
import { FormError, inputClass } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { WhatsAppIcon } from "@components/ui/icons";
import { SHAPES, useShareCard, type CardShape } from "@components/merchant/ShareCardCanvas";

const HEADLINES = ["جديد عنا", "خصم اليوم", "متوفر الآن", "بسعر الجملة", "آخر القطع"];

export default function SharePage() {
  const { user } = useSession("merchant");
  const store = user?.store;
  const { data, error } = useAuthData<Page<MerchantProduct>>("/merchant/products?status=ACTIVE&pageSize=100");
  const [productId, setProductId] = useState("");
  const [shape, setShape] = useState<CardShape>("story");
  const [headline, setHeadline] = useState(HEADLINES[0]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const products = data?.items ?? [];
  useEffect(() => {
    if (!productId && products.length) setProductId(products[0].id);
  }, [products, productId]);

  const selected = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);
  // A stable object, otherwise the card would repaint on every render
  const product = useMemo(
    () =>
      selected
        ? {
            id: selected.id,
            title: selected.title,
            price: selected.price,
            oldPrice: selected.oldPrice,
            currency: selected.currency,
            priceType: selected.priceType,
            images: selected.images,
          }
        : null,
    [selected],
  );
  const cardStore = useMemo(() => ({ name: store?.name ?? "", slug: store?.slug ?? "" }), [store?.name, store?.slug]);
  const url = product ? webUrl(`/products/${product.id}?src=card`) : store ? webUrl(`/stores/${store.slug}?src=card`) : "";

  const { canvasRef, drawing, warning, toBlob } = useShareCard({
    product,
    store: cardStore,
    shape,
    url,
    headline,
  });

  const fileName = `tujjar-${product ? product.id : store?.slug}-${shape}.png`;

  const download = async () => {
    setSaving(true);
    setNote("");
    const blob = await toBlob();
    setSaving(false);
    if (!blob) return setNote("تعذّر إنشاء الصورة على هذا المتصفح، جرّب من متصفح آخر.");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    setNote("نزّلت الصورة — افتح واتساب وانشرها على حالتك أو ابعتها لزبائنك.");
  };

  /** On phones the picture can go straight to WhatsApp without downloading it first. */
  const share = async () => {
    setNote("");
    const blob = await toBlob();
    if (!blob) return setNote("تعذّر إنشاء الصورة على هذا المتصفح.");
    const file = new File([blob], fileName, { type: "image/png" });
    const text = product ? `${headline}: ${product.title} — ${priceLabel(product).main}\n${url}` : `${store?.name}\n${url}`;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch {
        return;
      }
    }
    await download();
    window.open(whatsappLink("", text), "_blank", "noopener");
  };

  if (!store) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">بطاقة للمشاركة</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          اصنع صورة جاهزة لمنتجك فيها السعر واسم محلك ورمز QR، ونزّلها بضغطة لتنشرها على حالة واتساب أو الفيسبوك.
          الزبون يمسح الرمز فيفتح المنتج ويطلبه مباشرة.
        </p>
      </div>

      <FormError message={error} />

      {data && products.length === 0 ? (
        <EmptyState icon="🖼" title="ما في منتجات معروضة بعد">
          أضف منتجاً واعرضه، وبعدها بتقدر تصنع بطاقة مشاركة إله.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">المنتج</span>
              <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>

            <div className="text-sm">
              <span className="mb-1.5 block font-medium">شكل الصورة</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SHAPES) as CardShape[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShape(s)}
                    className={`rounded-xl p-3 text-start ring-1 transition ${shape === s ? "bg-brand-50 font-bold ring-brand-500" : "ring-line"}`}
                  >
                    {SHAPES[s].label}
                    <span className="mt-0.5 block text-[11px] font-normal text-muted">{SHAPES[s].hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">الجملة فوق الصورة</span>
              <input className={inputClass} value={headline} maxLength={24} onChange={(e) => setHeadline(e.target.value)} placeholder="مثال: خصم اليوم" />
              <span className="mt-2 flex flex-wrap gap-1.5">
                {HEADLINES.map((h) => (
                  <button key={h} type="button" onClick={() => setHeadline(h)} className="rounded-full bg-sand px-2.5 py-1 text-xs">
                    {h}
                  </button>
                ))}
                <button type="button" onClick={() => setHeadline("")} className="rounded-full px-2.5 py-1 text-xs text-muted ring-1 ring-line">
                  بلا جملة
                </button>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={share} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-wa px-5 font-bold text-white">
                <WhatsAppIcon size={20} /> شارك على واتساب
              </button>
              <button type="button" onClick={download} disabled={saving || drawing} className="press h-12 rounded-xl px-5 font-bold ring-1 ring-line disabled:opacity-50">
                {saving ? "جارٍ…" : "تنزيل الصورة"}
              </button>
            </div>
            {(note || warning) && <p className="rounded-xl bg-sand px-4 py-3 text-sm leading-7">{note || warning}</p>}
            <p className="text-xs leading-6 text-muted">
              الصورة تُصنع داخل متصفحك ولا تُرفع لأي مكان. على الموبايل بيفتح واتساب مباشرة، وعلى الكمبيوتر بتتنزل
              الصورة ثم بترفعها بنفسك.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm">
              <canvas
                ref={canvasRef}
                className={`w-full rounded-card shadow-card ring-1 ring-line transition ${drawing ? "opacity-60" : ""}`}
                aria-label="معاينة بطاقة المشاركة"
              />
              <p className="mt-2 text-center text-xs text-muted">معاينة — الصورة تُنزَّل بحجم {SHAPES[shape].w}×{SHAPES[shape].h}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
