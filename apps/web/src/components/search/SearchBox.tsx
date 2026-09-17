"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_API } from "@lib/api";
import { SearchIcon } from "@components/ui/icons";

type Suggestions = {
  products: { id: string; title: string; image: string | null; icon: string }[];
  stores: { slug: string; name: string; logoUrl: string | null }[];
  categories: { slug: string; name: string; icon: string }[];
  correctedQuery: string | null;
  alsoSearched: string[];
};

type Item = { key: string; href: string; label: string; hint?: string; icon?: string; image?: string | null };

/**
 * Search field with as-you-type suggestions from the smart search: products, stores and sections,
 * spelling fixes ("هل تقصد") and the dialect words it understood. Works as a plain form without JavaScript.
 */
export function SearchBox({
  variant,
  defaultValue = "",
  hidden = {},
  placeholder = "ابحث عن منتج أو متجر…",
}: {
  variant: "header" | "hero" | "page";
  defaultValue?: string;
  hidden?: Record<string, string>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [data, setData] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLFormElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${PUBLIC_API}/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Suggestions | null) => {
          setData(d);
          setActive(-1);
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const searchHref = (term: string) => {
    const sp = new URLSearchParams({ ...hidden, q: term });
    return `/search?${sp.toString()}`;
  };

  const items: Item[] = data
    ? [
        ...(data.correctedQuery ? [{ key: "fix", href: searchHref(data.correctedQuery), label: data.correctedQuery, hint: "هل تقصد" }] : []),
        ...data.products.map((p) => ({ key: `p${p.id}`, href: `/products/${p.id}`, label: p.title, icon: p.icon, image: p.image })),
        ...data.categories.map((c) => ({ key: `c${c.slug}`, href: `/categories/${c.slug}`, label: c.name, icon: c.icon, hint: "قسم" })),
        ...data.stores.map((s) => ({ key: `s${s.slug}`, href: `/stores/${s.slug}`, label: s.name, icon: "🏪", image: s.logoUrl, hint: "متجر" })),
      ]
    : [];
  const show = open && q.trim().length >= 2 && !!data && (items.length > 0 || data.alsoSearched.length > 0);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const styles = {
    header: {
      form: "relative hidden flex-1 md:block",
      input: "h-11 w-full rounded-full border border-line bg-surface ps-10 pe-4 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
      icon: "start-3",
    },
    hero: {
      form: "relative mt-7 flex max-w-2xl gap-2 rounded-2xl bg-surface p-2 shadow-card ring-1 ring-line",
      input: "h-12 w-full rounded-xl bg-transparent ps-11 pe-3 text-base outline-none",
      icon: "start-3",
    },
    page: {
      form: "relative mb-5 md:hidden",
      input: "h-12 w-full rounded-2xl border border-line bg-surface ps-11 pe-4 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
      icon: "start-3",
    },
  }[variant];

  return (
    <form
      ref={root}
      action="/search"
      role="search"
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) return go(items[active].href);
        if (q.trim()) go(searchHref(q.trim()));
      }}
    >
      <div className="relative flex-1">
        <SearchIcon className={`pointer-events-none absolute inset-y-0 my-auto text-muted ${styles.icon}`} size={variant === "header" ? 18 : 20} />
        <input
          name="q"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label="بحث"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className={styles.input}
        />
      </div>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {variant === "hero" && (
        <button className="h-12 rounded-xl bg-brand-600 px-6 font-bold text-white transition hover:bg-brand-700">ابحث</button>
      )}

      {show && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-surface text-start text-ink shadow-xl ring-1 ring-line">
          <ul id={listId} role="listbox" className="max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-1.5">
            {items.map((it, i) => (
              <li key={it.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm transition ${i === active ? "bg-sand" : "hover:bg-sand/70"}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand text-base">
                    {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : it.key === "fix" ? <SearchIcon size={16} /> : it.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {it.key === "fix" ? (
                      <>
                        هل تقصد <b className="text-brand-700">{it.label}</b>؟
                      </>
                    ) : (
                      it.label
                    )}
                  </span>
                  {it.hint && it.key !== "fix" && <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] text-muted">{it.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line bg-sand/40 px-4 py-2.5 text-xs text-muted">
            <button type="button" onClick={() => go(searchHref(q.trim()))} className="font-bold text-brand-700 hover:underline">
              كل النتائج عن «{q.trim()}»
            </button>
            {data.alsoSearched.length > 0 && <span>· نبحث أيضاً عن: {data.alsoSearched.slice(0, 4).join("، ")}</span>}
          </div>
        </div>
      )}
    </form>
  );
}
