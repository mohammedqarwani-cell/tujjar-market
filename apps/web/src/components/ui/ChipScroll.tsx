"use client";

type Item = { label: string; count?: number };

export default function ChipScroll({
  items = [],
  title,
  onSelect,
  hrefFor,
}: {
  items?: Item[];
  title: string;
  onSelect?: (label: string) => void; // جديد
  hrefFor?: (label: string) => string; // اختياري (بديل)
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {safeItems.map((x) =>
          onSelect ? (
            <button
              key={x.label}
              type="button"
              onClick={() => onSelect(x.label)}
              className="shrink-0 rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
            >
              {x.label}
              {typeof x.count === "number" ? ` (${x.count})` : ""}
            </button>
          ) : (
            <a
              key={x.label}
              href={hrefFor ? hrefFor(x.label) : "#"}
              className="shrink-0 rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
            >
              {x.label}
              {typeof x.count === "number" ? ` (${x.count})` : ""}
            </a>
          )
        )}
      </div>
    </section>
  );
}
