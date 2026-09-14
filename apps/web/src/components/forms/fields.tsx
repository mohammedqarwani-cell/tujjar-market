export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:opacity-60";

export const textareaClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base leading-7 outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function Field({
  label,
  hint,
  optional,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">(اختياري)</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = "جارِ الحفظ…",
  className = "",
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-12 rounded-xl bg-brand-600 px-6 font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-olive-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute start-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1 rounded-xl bg-sand p-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-medium transition ${value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
