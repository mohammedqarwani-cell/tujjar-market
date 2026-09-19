import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiGet, toQuery } from "@lib/api";
import { GOV_COOKIE } from "@lib/gov";
import type { Page } from "@lib/types";
import { EmptyState } from "@components/ui/Section";
import { PostCard, type FeedPost } from "@components/feed/PostCard";
import { Stories, type StoryGroup } from "@components/feed/Stories";

export const metadata: Metadata = {
  title: "الجديد من المحلات",
  description: "عروض المحلات وجديدها: منشورات وفيديوهات قصيرة وحالات من أسواق سوريا.",
};

const TABS = [
  { id: "", label: "الكل" },
  { id: "POST", label: "منشورات" },
  { id: "REEL", label: "ريلز" },
];

type Props = { searchParams: Promise<{ kind?: string }> };

export default async function FeedPage({ searchParams }: Props) {
  const kind = (await searchParams).kind ?? "";
  const gov = (await cookies()).get(GOV_COOKIE)?.value ?? "";
  const [feed, stories] = await Promise.all([
    apiGet<Page<FeedPost>>(`/feed${toQuery({ gov, kind, pageSize: 20 })}`, 30).catch(() => null),
    apiGet<StoryGroup[]>(`/stories${toQuery({ gov })}`, 30).catch(() => [] as StoryGroup[]),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">الجديد من المحلات</h1>
        <p className="mt-1 text-sm leading-7 text-muted">عروض وبضاعة جديدة، ينشرها أصحاب المحلات بأنفسهم.</p>
      </div>

      {stories.length > 0 && <Stories groups={stories} />}

      <div className="flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.id || "all"}
            href={`/feed${t.id ? `?kind=${t.id}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${kind === t.id ? "bg-ink text-canvas" : "bg-surface text-muted ring-1 ring-line"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!feed || feed.items.length === 0 ? (
        <EmptyState icon="📣" title="ما في منشورات بعد">
          لسا ما نشرت المحلات شي هون. تصفّح المنتجات لحد ما يبدأوا ينشروا عروضهم.
          <div className="mt-5">
            <Link href="/search" className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white">تصفّح المنتجات</Link>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {feed.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
