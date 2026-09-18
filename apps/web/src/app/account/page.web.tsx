"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayPhone } from "@lib/format";
import { signOut, useSession } from "@lib/session";
import { useFavorites } from "@lib/favorites";
import { EmptyState } from "@components/ui/Section";
import { BellIcon, HeartIcon, LogoutIcon, ShieldIcon, StoreIcon } from "@components/ui/icons";

export default function AccountPage() {
  const router = useRouter();
  const { status, user } = useSession("web");
  const favorites = useFavorites();

  if (status === "unknown" || status === "loading") {
    return <div className="mx-auto h-[50vh] max-w-xl animate-pulse px-4 py-10" aria-busy="true" />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState icon="👤" title="حسابك في تُجّار ماركت">
          سجّل الدخول لتطلب من المتاجر وتتابع طلباتك، ولتصلك العروض وانخفاض أسعار مفضلتك.
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/account/login" className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700">تسجيل الدخول</Link>
            <Link href="/account/register" className="rounded-xl px-5 py-2.5 font-bold text-ink ring-1 ring-line hover:ring-brand-200">حساب جديد</Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <div className="rounded-card bg-surface p-6 ring-1 ring-line">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            {user.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p dir="ltr" className="text-right text-sm text-muted">{displayPhone(user.phone)}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-olive-700">
          <ShieldIcon size={16} /> رقمك موثّق، ولا يظهر للتجار عند الإبلاغ.
        </p>
      </div>

      <Link href="/account/orders" className="flex items-center justify-between rounded-card bg-surface p-5 ring-1 ring-line hover:ring-brand-200">
        <span className="flex items-center gap-3 font-medium"><span aria-hidden>🛒</span> طلباتي</span>
        <span className="text-sm text-muted">←</span>
      </Link>

      <Link href="/favorites" className="flex items-center justify-between rounded-card bg-surface p-5 ring-1 ring-line hover:ring-brand-200">
        <span className="flex items-center gap-3 font-medium"><HeartIcon size={20} className="text-danger" /> المفضلة</span>
        <span className="text-sm text-muted">{favorites.length} منتج ←</span>
      </Link>

      <Link href="/account/following" className="flex items-center justify-between rounded-card bg-surface p-5 ring-1 ring-line hover:ring-brand-200">
        <span className="flex items-center gap-3 font-medium"><StoreIcon size={20} className="text-brand-600" /> المتاجر التي أتابعها</span>
        <span className="text-sm text-muted">←</span>
      </Link>

      <Link href="/account/phone" className="flex items-center justify-between rounded-card bg-surface p-5 ring-1 ring-line hover:ring-brand-200">
        <span className="flex items-center gap-3 font-medium"><ShieldIcon size={20} className="text-brand-600" /> تغيير رقم الموبايل</span>
        <span className="text-sm text-muted">←</span>
      </Link>

      <Link href="/notifications/settings" className="flex items-center justify-between rounded-card bg-surface p-5 ring-1 ring-line hover:ring-brand-200">
        <span className="flex items-center gap-3 font-medium"><BellIcon size={20} className="text-olive-600" /> إعدادات الإشعارات</span>
        <span className="text-sm text-muted">←</span>
      </Link>

      <button
        type="button"
        onClick={async () => {
          await signOut("web");
          router.replace("/");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-surface p-4 font-medium text-danger ring-1 ring-line hover:bg-danger/5"
      >
        <LogoutIcon size={18} /> تسجيل الخروج
      </button>
    </div>
  );
}
