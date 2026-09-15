import Link from "next/link";
import type { VerificationLevel } from "@lib/types";
import { LEVELS, atLeast } from "@lib/verification";
import { ShieldIcon, VerifiedIcon } from "@components/ui/icons";

/** Small mark beside a store name. Only a verified shop earns the check badge. */
export function VerifiedMark({ level, size = 16 }: { level: VerificationLevel; size?: number }) {
  if (level === "REGISTERED") return null;
  const label = LEVELS[level].badge;
  return (
    <span title={label} className="inline-flex shrink-0">
      {atLeast(level, "LOCATION") ? (
        <VerifiedIcon size={size} className={level === "PREMIUM" ? "text-brand-600" : "text-olive-500"} />
      ) : (
        <ShieldIcon size={size - 1} className="text-olive-600" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

const BADGE_STYLES: Record<VerificationLevel, string> = {
  REGISTERED: "bg-sand text-muted",
  IDENTITY: "bg-olive-50 text-olive-700",
  LOCATION: "bg-olive-50 text-olive-700",
  PREMIUM: "bg-brand-50 text-brand-700",
};

/** Full badge for store pages; links to the page explaining what each level proves. */
export function VerificationBadge({ level, marketName }: { level: VerificationLevel; marketName?: string | null }) {
  const text = atLeast(level, "LOCATION") && marketName ? `${LEVELS[level].badge} في ${marketName}` : LEVELS[level].badge;
  return (
    <Link
      href="/verification"
      title={LEVELS[level].proof}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition hover:opacity-80 ${BADGE_STYLES[level]}`}
    >
      <VerifiedMark level={level} size={15} />
      {text}
    </Link>
  );
}
