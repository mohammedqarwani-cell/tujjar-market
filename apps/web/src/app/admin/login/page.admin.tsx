import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@components/brand/Logo";
import { LoginForm } from "@components/auth/LoginForm";
import { ShieldIcon } from "@components/ui/icons";

export const metadata: Metadata = { title: "دخول الإدارة", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <LogoMark size={44} />
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-canvas">
          <ShieldIcon size={13} /> لوحة الإدارة
        </p>
        <h1 className="mt-2 text-2xl font-bold">دخول فريق المنصة</h1>
        <p className="mt-1 text-sm text-muted">الدخول محمي بالمصادقة الثنائية، وكل العمليات مسجّلة.</p>
        <Suspense>
          <LoginForm audience="admin" />
        </Suspense>
      </div>
    </div>
  );
}
