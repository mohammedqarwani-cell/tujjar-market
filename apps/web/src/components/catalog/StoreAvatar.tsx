export function StoreAvatar({
  name,
  logoUrl,
  className = "h-12 w-12 text-lg",
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className={`shrink-0 rounded-2xl bg-surface object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white ${className}`}
    >
      {name.trim().charAt(0)}
    </span>
  );
}
