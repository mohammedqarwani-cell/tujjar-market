"use client";

import { PhoneIcon, WhatsAppIcon } from "@components/ui/icons";
import { SITE_URL, trackContact, whatsappLink } from "@lib/contact";

type Props = {
  store: { slug: string; name: string; whatsapp: string; phone: string | null };
  product?: { id: string; title: string; priceText: string };
  layout?: "stack" | "row";
};

export function ContactButtons({ store, product, layout = "row" }: Props) {
  const message = product
    ? `مرحباً ${store.name}، شفت «${product.title}» على تُجّار ماركت بسعر ${product.priceText}. هل ما زال متوفراً؟\n${SITE_URL}/products/${product.id}`
    : `مرحباً ${store.name}، وصلت لمتجركم عن طريق تُجّار ماركت وحابب أستفسر.\n${SITE_URL}/stores/${store.slug}`;
  const callNumber = store.phone ?? store.whatsapp;

  return (
    <div className={`flex gap-2 ${layout === "stack" ? "flex-col" : ""}`}>
      <a
        href={whatsappLink(store.whatsapp, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackContact(store.slug, "WHATSAPP", product?.id)}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-wa px-5 font-bold text-white shadow-sm transition hover:bg-wa-dark"
      >
        <WhatsAppIcon size={22} />
        تواصل واتساب
      </a>
      <a
        href={`tel:+${callNumber}`}
        onClick={() => trackContact(store.slug, "CALL", product?.id)}
        aria-label={`اتصال بـ ${store.name}`}
        className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-surface px-5 font-bold text-ink ring-1 ring-line transition hover:ring-brand-200 ${layout === "stack" ? "" : "shrink-0"}`}
      >
        <PhoneIcon size={20} />
        <span className={layout === "stack" ? "" : "hidden sm:inline"}>اتصال</span>
      </a>
    </div>
  );
}
