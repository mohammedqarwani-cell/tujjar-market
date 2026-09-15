import Link from "next/link";
import { EmptyState } from "@components/ui/Section";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon="🧭" title="الصفحة غير موجودة">
        <p>ربما حُذف المنتج أو تغيّر الرابط.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-2.5 font-bold text-white hover:bg-brand-700"
        >
          العودة للرئيسية
        </Link>
      </EmptyState>
    </div>
  );
}
