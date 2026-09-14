import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@components/brand/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "دخول التجار", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <LogoMark size={44} />
        <h1 className="mt-4 text-2xl font-bold">أهلاً بعودتك</h1>
        <p className="mt-1 text-sm text-muted">سجّل الدخول لإدارة متجرك ومنتجاتك.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        ما عندك متجر؟{" "}
        <Link href="/join" className="font-bold text-brand-700 hover:text-brand-900">
          افتح متجرك مجاناً
        </Link>
      </p>
    </div>
  );
}
