import Link from "next/link";
import type { StoreCardData } from "@lib/types";
import { storeLocation } from "@lib/format";
import { PinIcon, TruckIcon, VerifiedIcon } from "@components/ui/icons";
import { StoreAvatar } from "./StoreAvatar";

export function StoreCard({ store: s }: { store: StoreCardData }) {
  return (
    <Link
      href={`/stores/${s.slug}`}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/60 transition duration-200 hover:-translate-y-0.5 hover:ring-brand-200"
    >
      <div className="relative h-24 overflow-hidden bg-gradient-to-l from-brand-100 to-olive-100">
        {s.coverUrl ? (
          <img src={s.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="pattern-arches absolute inset-0" />
        )}
        {s.category && (
          <span className="absolute end-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
            {s.category.icon} {s.category.name}
          </span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-4">
        <StoreAvatar name={s.name} logoUrl={s.logoUrl} className="-mt-8 h-16 w-16 border-4 border-surface text-xl" />
        <div className="mt-2 flex items-center gap-1.5">
          <h3 className="truncate font-bold text-ink">{s.name}</h3>
          {s.isVerified && <VerifiedIcon size={17} className="shrink-0 text-olive-500" />}
        </div>
        {s.tagline && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{s.tagline}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <PinIcon size={14} className="text-brand-600" />
            {storeLocation(s)}
          </span>
          {s.hasDelivery && (
            <span className="flex items-center gap-1 text-olive-600">
              <TruckIcon size={14} />
              توصيل
            </span>
          )}
        </div>
        <div className="mt-auto pt-3 text-xs font-medium text-brand-700">{s._count.products} منتج ←</div>
      </div>
    </Link>
  );
}
