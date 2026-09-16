import { StarIcon } from "@components/ui/icons";

/** Read-only star row for a rating out of 5. */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={`inline-flex items-center ${className}`} role="img" aria-label={`${value.toFixed(1)} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} size={size} className={i <= filled ? "text-brand-500" : "text-line"} />
      ))}
    </span>
  );
}
