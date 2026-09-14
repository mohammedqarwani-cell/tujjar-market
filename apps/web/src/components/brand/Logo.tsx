export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#b86e14" />
      <path d="M11 31V18.5a9 9 0 0 1 18 0V31" fill="none" stroke="#fdf6ea" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M16 31v-9.5a4 4 0 0 1 8 0V31" fill="#6b7a36" />
      <circle cx="20" cy="11.5" r="1.8" fill="#f2cc8f" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-bold tracking-tight text-ink">تُجّار ماركت</span>
          <span className="mt-1 text-[10px] font-medium text-muted">أسواق سوريا بين يديك</span>
        </span>
      )}
    </span>
  );
}
