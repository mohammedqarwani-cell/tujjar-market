"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PUBLIC_API } from "@lib/api";
import { formatNumber, priceLabel, timeAgo } from "@lib/format";
import type { ProductCardData, VerificationLevel } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { AddToCart } from "@components/orders/AddToCart";

export type FeedPost = {
  id: string;
  kind: "POST" | "REEL" | "STORY";
  text: string | null;
  images: string[];
  videoUrl: string | null;
  views: number;
  createdAt: string;
  product: ProductCardData | null;
  store: {
    slug: string;
    name: string;
    logoUrl: string | null;
    verificationLevel: VerificationLevel;
    governorate: { name: string };
  };
};

function track(id: string, what: "view" | "click") {
  fetch(`${PUBLIC_API}/feed/${id}/${what}`, { method: "POST", keepalive: true, credentials: "omit", headers: { "X-Client": "web" } }).catch(() => undefined);
}

/** A reel plays by itself while it is on screen, and stays muted until the viewer asks for sound. */
function Reel({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative bg-ink">
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="max-h-[70vh] w-full object-contain"
        playsInline
        loop
        muted={muted}
        controls={false}
        onClick={() => {
          const video = ref.current;
          if (video) video.paused ? void video.play() : video.pause();
        }}
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-3 end-3 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
      >
        {muted ? "🔇 صوت" : "🔊 كتم"}
      </button>
    </div>
  );
}

/** One published item in the feed: the shop, what it wrote, its pictures or video, and the offer. */
export function PostCard({ post }: { post: FeedPost }) {
  const seen = useRef(false);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seen.current) {
          seen.current = true;
          track(post.id, "view");
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id]);

  const price = post.product ? priceLabel(post.product) : null;

  return (
    <article ref={card} className="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/60">
      <header className="flex items-center gap-3 p-3">
        <Link href={`/stores/${post.store.slug}`} className="shrink-0">
          <StoreAvatar name={post.store.name} logoUrl={post.store.logoUrl} className="h-11 w-11 !rounded-full text-base" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/stores/${post.store.slug}`} className="truncate font-bold hover:text-brand-700">{post.store.name}</Link>
            <VerifiedMark level={post.store.verificationLevel} size={14} />
          </div>
          <div className="text-xs text-muted">
            {post.store.governorate.name} · {timeAgo(post.createdAt)}
            {post.kind === "REEL" ? " · ريل" : ""}
          </div>
        </div>
      </header>

      {post.text && <p className="whitespace-pre-line px-4 pb-3 text-sm leading-7">{post.text}</p>}

      {post.videoUrl ? (
        <Reel src={post.videoUrl} poster={post.images[0]} />
      ) : post.images.length === 1 ? (
        <img src={post.images[0]} alt="" loading="lazy" className="max-h-[70vh] w-full object-cover" />
      ) : post.images.length > 1 ? (
        <div className="no-scrollbar flex snap-x snap-mandatory gap-1 overflow-x-auto">
          {post.images.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" className="aspect-square w-4/5 shrink-0 snap-center object-cover sm:w-3/5" />
          ))}
        </div>
      ) : null}

      {post.product && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line p-3">
          {post.product.images[0] && <img src={post.product.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1">
            <Link
              href={`/products/${post.product.id}`}
              onClick={() => track(post.id, "click")}
              className="line-clamp-1 text-sm font-bold hover:text-brand-700"
            >
              {post.product.title}
            </Link>
            <div className="text-sm font-bold text-brand-700">{price?.main}</div>
          </div>
          <div className="w-28 shrink-0">
            <AddToCart variant="compact" product={post.product} />
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between px-4 py-2 text-xs text-muted">
        <span>👁 {formatNumber(post.views)}</span>
        <Link href={`/stores/${post.store.slug}`} className="font-medium text-brand-700">زُر المتجر ←</Link>
      </footer>
    </article>
  );
}
