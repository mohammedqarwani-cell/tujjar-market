"use client";

import { useState } from "react";
import Link from "next/link";
import { cartTotal, clearStoreCart, setQuantity, useCart, type StoreCart } from "@lib/cart";
import { formatNumber, priceLabel } from "@lib/format";
import type { Currency } from "@lib/types";
import { EmptyState } from "@components/ui/Section";
import { CheckoutDialog } from "@components/orders/CheckoutDialog";

const money = (value: number, currency: Currency) => priceLabel({ price: value, currency, priceType: "FIXED" }).main;

function StoreBasket({ cart, onCheckout }: { cart: StoreCart; onCheckout: () => void }) {
  const currency = cart.items[0]?.currency ?? "SYP";
  const total = cartTotal(cart.items);
  const pieces = cart.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <section className="rounded-card bg-surface ring-1 ring-line">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
        <div className="min-w-0">
          <Link href={`/stores/${cart.store.slug}`} className="font-bold hover:text-brand-700">{cart.store.name}</Link>
          <p className="text-xs text-muted">
            {formatNumber(cart.items.length)} صنف · {formatNumber(pieces)} قطعة
            {cart.store.hasDelivery ? " · يوصّل" : " · استلام من المحل"}
          </p>
        </div>
        <button type="button" onClick={() => clearStoreCart(cart.store.slug)} className="text-xs font-medium text-danger">
          أفرغ سلة هالمتجر
        </button>
      </header>

      <ul className="divide-y divide-line">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-4">
            <Link href={`/products/${item.id}`} className="shrink-0">
              {item.image ? (
                <img src={item.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-sand text-2xl" aria-hidden>🛍</span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/products/${item.id}`} className="line-clamp-2 text-sm font-medium hover:text-brand-700">{item.title}</Link>
              <div className="mt-1 text-sm font-bold text-brand-700">
                {item.priceType !== "FIXED" || item.price === null
                  ? "السعر عند الطلب"
                  : money(item.price * item.quantity, item.currency)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setQuantity(cart.store.slug, item.id, item.quantity - 1)} aria-label="إنقاص" className="h-9 w-9 rounded-lg bg-sand font-bold">
                  −
                </button>
                <span className="w-8 text-center font-bold">{formatNumber(item.quantity)}</span>
                <button type="button" onClick={() => setQuantity(cart.store.slug, item.id, item.quantity + 1)} aria-label="زيادة" className="h-9 w-9 rounded-lg bg-sand font-bold">
                  +
                </button>
              </div>
              <button type="button" onClick={() => setQuantity(cart.store.slug, item.id, 0)} className="text-[11px] text-muted hover:text-danger">
                إزالة
              </button>
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
        <div>
          <div className="text-xs text-muted">الإجمالي قبل التوصيل</div>
          <div className="text-lg font-bold">{total === null ? "يحدده التاجر" : money(total, currency)}</div>
        </div>
        <button type="button" onClick={onCheckout} className="press h-12 rounded-xl bg-brand-600 px-6 font-bold text-white">
          متابعة الطلب
        </button>
      </footer>
    </section>
  );
}

export default function CartPage() {
  const carts = useCart();
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const checkout = carts.find((c) => c.store.slug === checkoutSlug) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">سلة المشتريات</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          لكل متجر سلة لحالها، لأن كل طلب بيروح لمتجر واحد. جمّع كل يلي بدك ياه من المحل وابعتهم بطلب واحد.
        </p>
      </div>

      {carts.length === 0 ? (
        <EmptyState icon="🛒" title="سلتك فاضية">
          تصفّح المنتجات واضغط «أضف للسلة»، وبتلاقيهم كلهم هون جاهزين للطلب.
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/search" className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white">تصفّح المنتجات</Link>
            <Link href="/search?offers=1" className="rounded-xl px-5 py-2.5 font-bold ring-1 ring-line">شوف العروض</Link>
          </div>
        </EmptyState>
      ) : (
        carts.map((cart) => <StoreBasket key={cart.store.slug} cart={cart} onCheckout={() => setCheckoutSlug(cart.store.slug)} />)
      )}

      {checkout && <CheckoutDialog cart={checkout} onClose={() => setCheckoutSlug(null)} />}
    </div>
  );
}
