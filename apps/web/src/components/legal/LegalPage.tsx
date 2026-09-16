export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string[]; id?: string }[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">آخر تحديث: {updated}</p>
      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm leading-7 text-brand-900">
        مسودة أولية تحتاج مراجعة قانونية قبل الإطلاق الرسمي.
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <section key={s.heading} id={s.id} className="scroll-mt-24">
            <h2 className="text-lg font-bold">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-3 space-y-3 leading-8 text-ink/85">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
