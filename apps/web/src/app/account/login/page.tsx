import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@components/brand/Logo";
import { LoginForm } from "@components/auth/LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false } };

export default function BuyerLoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-2xl font-bold">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted">ادخل لحفظ المفضلة والإبلاغ عن الإعلانات المخالفة.</p>
        <Suspense>
          <LoginForm audience="web" />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        ما عندك حساب؟{" "}
        <Link href="/account/register" className="font-bold text-brand-700 hover:text-brand-900">أنشئ حساباً</Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        صاحب محل؟ <Link href="/login" className="font-medium text-ink hover:text-brand-700">دخول التجار</Link>
      </p>
    </div>
  );
}
