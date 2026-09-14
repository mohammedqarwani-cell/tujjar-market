import Link from "next/link";

export function Section({
  title,
  subtitle,
  href,
  linkLabel = "عرض الكل",
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-4 ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-900">
            {linkLabel} ←
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon = "🔎",
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm leading-7 text-muted">{children}</div>}
    </div>
  );
}
