import Link from "next/link";
import { toQuery } from "@lib/api";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type Params = Record<string, string | undefined>;

export function Pagination({
  basePath,
  params,
  page,
  pages,
}: {
  basePath: string;
  params: Params;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => `${basePath}${toQuery({ ...params, page: p > 1 ? p : undefined })}`;
  const around = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1,
  );

  const cell = "flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-medium";
  return (
    <nav aria-label="الصفحات" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${cell} bg-surface ring-1 ring-line hover:ring-brand-200`} aria-label="السابق">
          <ChevronRightIcon size={18} />
        </Link>
      )}
      {around.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - around[i - 1] > 1 && <span className="text-muted">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${cell} ${p === page ? "bg-ink text-canvas" : "bg-surface ring-1 ring-line hover:ring-brand-200"}`}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className={`${cell} bg-surface ring-1 ring-line hover:ring-brand-200`} aria-label="التالي">
          <ChevronLeftIcon size={18} />
        </Link>
      )}
    </nav>
  );
}
