"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@lib/session";
import { useAuthData, type MerchantProduct } from "@lib/merchant";
import { formatNumber, timeAgo } from "@lib/format";
import { webUrl } from "@lib/urls";
import type { Page, ProductCardData } from "@lib/types";
import { FormError, inputClass, textareaClass } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";
import { XIcon } from "@components/ui/icons";

type Kind = "POST" | "REEL" | "STORY";

type StorePost = {
  id: string;
  kind: Kind;
  text: string | null;
  images: string[];
  videoUrl: string | null;
  views: number;
  clicks: number;
  status: "ACTIVE" | "HIDDEN" | "UNDER_REVIEW";
  createdAt: string;
  expiresAt: string | null;
  product: ProductCardData | null;
};

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "POST", label: "منشور", hint: "صور ونص — يبقى على صفحة متجرك" },
  { id: "REEL", label: "ريل", hint: "فيديو قصير — يظهر في قسم الريلز" },
  { id: "STORY", label: "حالة", hint: "صورة أو فيديو يختفي بعد 24 ساعة" },
];

const STATUS_LABEL: Record<StorePost["status"], string> = { ACTIVE: "منشور", HIDDEN: "مخفي", UNDER_REVIEW: "قيد المراجعة" };
const STATUS_STYLE: Record<StorePost["status"], string> = {
  ACTIVE: "bg-olive-50 text-olive-700",
  HIDDEN: "bg-sand text-muted",
  UNDER_REVIEW: "bg-brand-50 text-brand-700",
};

const MAX_IMAGES = 6;

export default function PostsPage() {
  const { data, error, reload } = useAuthData<Page<StorePost>>("/merchant/posts?pageSize=50");
  const { data: products } = useAuthData<Page<MerchantProduct>>("/merchant/products?status=ACTIVE&pageSize=100");

  const [kind, setKind] = useState<Kind>("POST");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [uploading, setUploading] = useState("");
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");
  const [note, setNote] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File, type: "image" | "video") => {
    setUploading(type);
    setFormError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const { url } = await apiRequest<{ url: string }>(type === "image" ? "/merchant/media" : "/merchant/media/video", {
        audience: "merchant",
        method: "POST",
        body,
      });
      if (type === "image") setImages((list) => [...list, url].slice(0, MAX_IMAGES));
      else setVideoUrl(url);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "تعذّر الرفع");
    } finally {
      setUploading("");
    }
  };

  const publish = async () => {
    setBusy("form");
    setFormError("");
    setNote("");
    try {
      await apiRequest("/merchant/posts", {
        audience: "merchant",
        method: "POST",
        body: {
          kind,
          text: text.trim() || undefined,
          images: kind === "REEL" ? [] : images,
          videoUrl: kind === "POST" ? undefined : videoUrl || undefined,
          productId: productId || undefined,
        },
      });
      setText("");
      setImages([]);
      setVideoUrl("");
      setProductId("");
      setNote(kind === "STORY" ? "نُشرت الحالة — بتختفي بعد 24 ساعة." : "نُشر! متابعو متجرك وصلهم إشعار.");
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "تعذّر النشر");
    } finally {
      setBusy("");
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy("");
    }
  };

  const needsVideo = kind === "REEL";
  const canPublish = needsVideo ? !!videoUrl : kind === "STORY" ? !!images.length || !!videoUrl : !!text.trim() || !!images.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">النشر</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          انشر عروضك وجديدك: منشور بصور، ريل بفيديو قصير، أو حالة تختفي بعد يوم. المتابعون بيوصلهم إشعار،
          وبيظهر نشرك في قسم «الجديد» وعلى صفحة متجرك.
        </p>
      </div>

      <section className="space-y-4 rounded-card bg-surface p-4 ring-1 ring-line sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-xl p-3 text-start text-sm ring-1 transition ${kind === k.id ? "bg-brand-50 font-bold ring-brand-500" : "ring-line"}`}
            >
              {k.label}
              <span className="mt-0.5 block text-[11px] font-normal leading-4 text-muted">{k.hint}</span>
            </button>
          ))}
        </div>

        <textarea
          className={textareaClass}
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === "REEL" ? "اكتب جملة تحت الفيديو (اختياري)" : "شو بدك تقول لزبائنك؟ مثلاً: وصلنا بضاعة جديدة، خصم 20% لآخر الأسبوع"}
        />

        {kind !== "REEL" && (
          <div>
            <div className="flex flex-wrap gap-2">
              {images.map((url) => (
                <span key={url} className="relative">
                  <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-line" />
                  <button
                    type="button"
                    onClick={() => setImages((list) => list.filter((u) => u !== url))}
                    aria-label="إزالة الصورة"
                    className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-canvas"
                  >
                    <XIcon size={14} />
                  </button>
                </span>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => imageInput.current?.click()}
                  disabled={!!uploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs text-muted"
                >
                  {uploading === "image" ? "جارٍ…" : "+ صورة"}
                </button>
              )}
            </div>
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, "image");
                e.target.value = "";
              }}
            />
          </div>
        )}

        {kind !== "POST" && (
          <div className="space-y-2">
            {videoUrl ? (
              <div className="flex items-center gap-3">
                <video src={videoUrl} className="h-28 w-20 rounded-xl bg-ink object-cover" muted playsInline controls />
                <button type="button" onClick={() => setVideoUrl("")} className="text-sm text-danger">
                  إزالة الفيديو
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInput.current?.click()}
                disabled={!!uploading}
                className="h-11 rounded-xl px-4 text-sm font-bold ring-1 ring-line disabled:opacity-50"
              >
                {uploading === "video" ? "جارٍ رفع الفيديو…" : "رفع فيديو قصير"}
              </button>
            )}
            <p className="text-xs leading-5 text-muted">MP4 أو WEBM، حتى 25 ميغابايت. الأفضل فيديو عمودي قصير (15–30 ثانية).</p>
            <input
              ref={videoInput}
              type="file"
              accept="video/mp4,video/webm"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, "video");
                e.target.value = "";
              }}
            />
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">اربطه بمنتج (اختياري)</span>
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">بلا منتج</option>
            {products?.items.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">لما تربطه بمنتج، بيطلع زر «اطلب الآن» تحت المنشور.</span>
        </label>

        <FormError message={formError} />
        {note && <p className="rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-700">{note}</p>}
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || busy === "form" || !!uploading}
          className="press h-12 w-full rounded-xl bg-brand-600 font-bold text-white disabled:opacity-50"
        >
          {busy === "form" ? "جارٍ النشر…" : kind === "STORY" ? "انشر الحالة" : kind === "REEL" ? "انشر الريل" : "انشر"}
        </button>
      </section>

      <FormError message={error} />

      <h2 className="font-bold">نشرك السابق</h2>
      {data?.items.length === 0 && (
        <EmptyState icon="📣" title="ما نشرت شي بعد">
          انشر عرضك الأول: صورة البضاعة الجديدة مع سعرها، أو فيديو قصير من داخل المحل.
        </EmptyState>
      )}

      {data?.items.map((post) => {
        const expired = post.expiresAt && new Date(post.expiresAt).getTime() < Date.now();
        return (
          <article key={post.id} className={`flex flex-col gap-3 rounded-card bg-surface p-4 ring-1 ring-line sm:flex-row ${busy === post.id ? "opacity-50" : ""}`}>
            {post.videoUrl ? (
              <video src={post.videoUrl} className="h-24 w-24 shrink-0 rounded-xl bg-ink object-cover" muted playsInline />
            ) : post.images[0] ? (
              <img src={post.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-sand text-2xl" aria-hidden>📝</span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold">{KINDS.find((k) => k.id === post.kind)?.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[post.status]}`}>
                  {expired ? "انتهت" : STATUS_LABEL[post.status]}
                </span>
                <span className="text-xs text-muted">{timeAgo(post.createdAt)}</span>
              </div>
              {post.text && <p className="mt-1.5 line-clamp-2 text-sm leading-6">{post.text}</p>}
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
                <span>👁 {formatNumber(post.views)} مشاهدة</span>
                <span>👆 {formatNumber(post.clicks)} نقرة</span>
                {post.product && (
                  <Link href={webUrl(`/products/${post.product.id}`)} target="_blank" className="hover:text-brand-700">
                    مرتبط بـ {post.product.title}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
              {post.status !== "UNDER_REVIEW" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act(post.id, () => apiRequest(`/merchant/posts/${post.id}`, { audience: "merchant", method: "PATCH", body: { status: post.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" } }))}
                  className="h-9 rounded-lg px-3 text-xs font-bold ring-1 ring-line"
                >
                  {post.status === "ACTIVE" ? "إخفاء" : "إظهار"}
                </button>
              )}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => window.confirm("حذف المنشور؟") && act(post.id, () => apiRequest(`/merchant/posts/${post.id}`, { audience: "merchant", method: "DELETE" }))}
                className="h-9 rounded-lg px-3 text-xs font-bold text-danger ring-1 ring-danger/30"
              >
                حذف
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
