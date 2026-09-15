"use client";

import { EmptyState } from "@components/ui/Section";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon="📡" title="تعذّر تحميل الصفحة">
        <p>قد يكون الاتصال ضعيفاً أو الخادم مشغولاً. جرّب مرة ثانية بعد لحظات.</p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-brand-600 px-6 py-2.5 font-bold text-white hover:bg-brand-700"
        >
          إعادة المحاولة
        </button>
      </EmptyState>
    </div>
  );
}
