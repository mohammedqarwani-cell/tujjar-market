import type { Metadata } from "next";
import Link from "next/link";
import { merchantUrl } from "@lib/urls";
import { LEVELS, LEVEL_ORDER } from "@lib/verification";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { ShieldIcon } from "@components/ui/icons";

export const metadata: Metadata = {
  title: "كيف نوثّق المتاجر",
  description: "مستويات توثيق التجار في تُجّار ماركت: الهوية، المحل، والزيارة الميدانية، مع رقابة مستمرة على المتاجر.",
};

export default function VerificationInfoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-olive-50 text-olive-600">
          <ShieldIcon size={26} />
        </span>
        <h1 className="text-3xl font-bold">كيف نوثّق المتاجر؟</h1>
      </div>
      <p className="mt-4 leading-8 text-muted">
        نتحقق من التجار على مراحل، بنفس الأسلوب الذي تعتمده المنصات العالمية الكبرى: كلما ارتفع مستوى المتجر، زادت الأدلة
        التي راجعها فريقنا بنفسه. الشارة بجانب اسم المتجر تخبرك بما تحققنا منه بالضبط.
      </p>

      <ol className="mt-8 space-y-3">
        {LEVEL_ORDER.map((level, i) => (
          <li key={level} className="flex gap-4 rounded-card bg-surface p-5 ring-1 ring-line">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand font-bold">{i}</span>
            <div>
              <h2 className="flex items-center gap-1.5 font-bold">
                {LEVELS[level].name}
                <VerifiedMark level={level} size={18} />
              </h2>
              <p className="mt-1 text-sm leading-7 text-muted">{LEVELS[level].proof}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="font-bold">رقابة مستمرة بعد التوثيق</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-7 text-muted">
          <li>البلاغات المؤكدة من الزبائن توقف شارة المتجر تلقائياً حتى تراجعها الإدارة.</li>
          <li>توثيق المحل يُجدَّد كل سنة بفيديو جديد، ويُلغى إذا غيّر التاجر اسم المتجر أو سوقه.</li>
          <li>نزور عيّنة عشوائية من المتاجر الموثّقة للتأكد منها ميدانياً.</li>
        </ul>
      </section>

      <section className="mt-4 rounded-card bg-brand-50 p-5 text-sm leading-7 text-brand-900 ring-1 ring-brand-100">
        <h2 className="font-bold">نصيحة للشراء بأمان</h2>
        <p className="mt-1">
          التوثيق يقلل المخاطر لكنه لا يلغيها: عاين البضاعة قبل الدفع كلما أمكن، ولا تحوّل مبالغ مسبقة لتاجر لا تثق به. وإذا
          لاحظت أي مخالفة، استخدم زر «إبلاغ» في صفحة المتجر أو المنتج.
        </p>
      </section>

      <p className="mt-6 text-sm text-muted">
        تاجر؟{" "}
        <Link href={merchantUrl("/dashboard/verification")} className="font-medium text-brand-700">
          وثّق متجرك من بوابة التجار
        </Link>
      </p>
    </div>
  );
}
