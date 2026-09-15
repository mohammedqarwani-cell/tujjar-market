import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@lib/api";
import type { Category, Governorate } from "@lib/types";
import { ChartIcon, ImageIcon, WhatsAppIcon } from "@components/ui/icons";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "افتح متجرك مجاناً",
  description: "اعرض منتجات محلك لزبائن محافظتك واستقبل استفساراتهم مباشرة على واتساب. مجاناً وخلال دقيقتين.",
};

const BENEFITS = [
  { Icon: WhatsAppIcon, title: "زبائن مباشرة على واتساب", text: "الزبون بيحكيك برسالة جاهزة فيها اسم المنتج وسعره. بدون وسيط وبدون عمولة." },
  { Icon: ImageIcon, title: "ارفع منتجاتك من الموبايل", text: "صوّر المنتج واكتب السعر. الصور بتنضغط تلقائياً لتفتح بسرعة حتى على نت ضعيف." },
  { Icon: ChartIcon, title: "اعرف شو عم يصير", text: "شوف كم شخص زار متجرك وكم واحد تواصل معك، وأي منتج مطلوب أكثر." },
];

export default async function JoinPage() {
  const [categories, governorates] = await Promise.all([
    apiGet<Category[]>("/categories", 300),
    apiGet<Governorate[]>("/governorates", 300),
  ]);

  return (
    <div className="relative overflow-hidden">
      <div className="pattern-arches absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_28rem] lg:py-14">
        <div className="lg:pt-6">
          <span className="inline-block rounded-full bg-olive-50 px-3 py-1 text-xs font-bold text-olive-700 ring-1 ring-olive-100">
            مجاني بالكامل للتجار
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-[1.35] sm:text-5xl sm:leading-[1.25]">
            محلك بالسوق،
            <br />
            <span className="text-brand-600">وزبائنك على الموبايل</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-8 text-muted">
            افتح متجرك على تُجّار ماركت خلال دقيقتين، وخلّي أهل محافظتك يلاقوا منتجاتك وأسعارك قبل ما ينزلوا
            عالسوق.
          </p>

          <ul className="mt-8 space-y-5">
            {BENEFITS.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand-600 shadow-card ring-1 ring-line">
                  <Icon size={24} />
                </span>
                <div>
                  <h2 className="font-bold">{title}</h2>
                  <p className="mt-1 text-sm leading-7 text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line sm:p-7">
          <h2 className="text-xl font-bold">أنشئ متجرك</h2>
          <p className="mt-1 text-sm text-muted">
            عندك حساب؟{" "}
            <Link href="/login" className="font-bold text-brand-700">سجّل الدخول</Link>
          </p>
          <RegisterForm
            categories={categories.map(({ id, name, icon }) => ({ id, name, icon }))}
            governorates={governorates.map(({ id, name, status, markets }) => ({
              id,
              name,
              status,
              markets: markets.map(({ id: mid, name: mname }) => ({ id: mid, name: mname })),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
