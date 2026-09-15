import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@lib/api";
import { merchantUrl } from "@lib/urls";
import type { Governorate } from "@lib/types";

export const metadata: Metadata = {
  title: "أسواق سوريا",
  description: "تصفح أسواق دمشق ومحلاتها: الحميدية، البزورية، الحريقة، مدحت باشا وغيرها، وقريباً باقي المحافظات.",
};

export default async function MarketsPage() {
  const governorates = await apiGet<Governorate[]>("/governorates", 300);
  // Only an explicit COMING_SOON closes a governorate, so a response cached before rollout statuses existed stays open
  const open = governorates.filter((g) => g.status !== "COMING_SOON");
  const withStores = open.filter((g) => g.storesCount > 0);
  const waiting = open.filter((g) => g.storesCount === 0);
  const soon = governorates.filter((g) => g.status === "COMING_SOON");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">أسواق سوريا</h1>
      <p className="mt-2 text-muted">اختر المحافظة والسوق، وشوف المحلات ومنتجاتها من مكانك.</p>

      <nav aria-label="المحافظات" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {open.map((g) => (
          <a
            key={g.slug}
            href={`#${g.slug}`}
            className="shrink-0 rounded-full bg-surface px-4 py-2 text-sm font-medium ring-1 ring-line hover:ring-brand-200"
          >
            {g.name}
            {g.storesCount > 0 && <span className="ms-1.5 text-xs text-muted">{g.storesCount}</span>}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        {withStores.map((g) => (
          <section key={g.slug} id={g.slug} className="scroll-mt-24">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xl font-bold">{g.name}</h2>
              <Link href={`/search?gov=${g.slug}&type=stores`} className="text-sm font-medium text-brand-700">
                {g.storesCount} متجر ←
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.markets.map((m) => (
                <Link
                  key={m.slug}
                  href={`/markets/${m.slug}`}
                  className="group relative overflow-hidden rounded-card bg-surface p-4 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-brand-200"
                >
                  <div className="pattern-arches absolute inset-y-0 end-0 w-20 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
                  <div className="relative">
                    <div className="font-bold">{m.name}</div>
                    <div className="mt-4 text-xs text-muted">
                      {m.storesCount > 0 ? `${m.storesCount} متجر` : "بانتظار أول محل"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {waiting.length > 0 && (
          <section className="rounded-card bg-sand/70 p-6">
            <h2 className="font-bold">محافظات تنتظر أول محلاتها</h2>
            <p className="mt-1 text-sm text-muted">
              {waiting.map((g) => g.name).join("، ")} — كن أول تاجر فيها واحصل على ظهور مميز.
            </p>
            <Link href={merchantUrl("/join")} className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
              افتح متجرك مجاناً
            </Link>
          </section>
        )}

        {soon.length > 0 && (
          <section className="rounded-card bg-surface p-6 ring-1 ring-line">
            <h2 className="font-bold">قريباً في محافظات أخرى</h2>
            <p className="mt-1 text-sm leading-7 text-muted">
              نفتح المحافظات تباعاً لنضمن التحقق من كل محل. تاجر في إحداها؟ سجّل اهتمامك ونتواصل معك أول ما يفتح التسجيل.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {soon.map((g) => (
                <li key={g.slug} className="rounded-full bg-sand px-3 py-1.5 text-sm">
                  {g.name}
                </li>
              ))}
            </ul>
            <Link href={merchantUrl("/join")} className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-canvas hover:bg-brand-900">
              سجّل اهتمامك كتاجر
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
