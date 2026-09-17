"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useSession } from "@lib/session";
import { webUrl } from "@lib/urls";
import { LogoMark } from "@components/brand/Logo";

/**
 * A QR code of the store page, as a printable A5 poster for the shop window or counter,
 * and as a PNG to share on social media.
 */
export default function StoreQrPage() {
  const { user } = useSession("merchant");
  const store = user?.store;
  const url = store ? webUrl(`/stores/${store.slug}?src=qr`) : "";
  const [svg, setSvg] = useState("");
  const [png, setPng] = useState("");

  useEffect(() => {
    if (!url) return;
    const opts = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#1f1a14", light: "#ffffff" } };
    QRCode.toString(url, { ...opts, type: "svg" }).then(setSvg).catch(() => setSvg(""));
    QRCode.toDataURL(url, { ...opts, width: 1024 }).then(setPng).catch(() => setPng(""));
  }, [url]);

  if (!store) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">رمز QR لمحلك</h1>
          <p className="mt-1 text-sm text-muted">اطبعه وعلّقه على واجهة المحل أو عند الصندوق: يمسحه الزبون فيفتح متجرك ويحفظه أو يتابعه.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            طباعة الملصق
          </button>
          {png && (
            <a href={png} download={`qr-${store.slug}.png`} className="rounded-xl px-5 py-2.5 text-sm font-bold ring-1 ring-line hover:ring-brand-200">
              تنزيل الصورة
            </a>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <article className="qr-poster flex aspect-[148/210] w-full max-w-sm flex-col items-center rounded-card bg-surface p-8 text-center shadow-card ring-1 ring-line print:max-w-none print:rounded-none print:shadow-none print:ring-0">
          <div className="flex items-center gap-2">
            <LogoMark size={36} />
            <span className="text-lg font-bold">تُجّار ماركت</span>
          </div>
          <h2 className="mt-6 text-2xl font-bold leading-snug">{store.name}</h2>
          <p className="mt-2 text-sm text-muted">امسح الرمز لتتصفح منتجاتنا وأسعارنا وتتواصل معنا على واتساب</p>
          <div className="my-6 w-full max-w-[16rem] rounded-2xl bg-white p-3 ring-1 ring-line [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-auto text-xs text-muted" dir="ltr">{webUrl(`/stores/${store.slug}`).replace(/^https?:\/\//, "")}</p>
        </article>
      </div>

      <style>{`@media print { @page { size: A5; margin: 0; } body * { visibility: hidden; } .qr-poster, .qr-poster * { visibility: visible; } .qr-poster { position: fixed; inset: 0; margin: auto; width: 148mm; height: 210mm; } }`}</style>
    </div>
  );
}
