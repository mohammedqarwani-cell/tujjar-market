"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toQuery } from "@lib/api";
import { webUrl } from "@lib/urls";
import { displayPhone, timeAgo } from "@lib/format";
import { adminBlob, adminFetch, apiRequest } from "@lib/session";
import { LEVELS } from "@lib/verification";
import type { Page, VerificationLevel } from "@lib/types";
import { FormError } from "@components/forms/fields";
import { EmptyState } from "@components/ui/Section";

type Slot = "idFront" | "idBack" | "selfie" | "video" | "document";
type Kind = "IDENTITY" | "LOCATION";

type AdminVerification = {
  id: string;
  kind: Kind;
  status: "PENDING" | "APPROVED" | "REJECTED";
  files: { slot: Slot; type: string; size: number }[];
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  capturedAt: string | null;
  geoCheck: "INSIDE" | "OUTSIDE" | "NO_GEOFENCE" | null;
  distanceMeters: number | null;
  rejectReason: string | null;
  reviewedAt: string | null;
  purgedAt: string | null;
  createdAt: string;
  reviewer: { name: string } | null;
  store: {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    verificationLevel: VerificationLevel;
    earnedLevel: VerificationLevel;
    governorate: { name: string };
    market: { name: string } | null;
    owner: { name: string; phone: string };
    _count: { verificationRequests: number };
  };
};

const KIND_LABELS: Record<Kind, string> = { IDENTITY: "توثيق هوية", LOCATION: "توثيق محل" };

const SLOT_LABELS: Record<Slot, string> = {
  idFront: "وجه الهوية",
  idBack: "ظهر الهوية",
  selfie: "صورة شخصية مع الهوية",
  video: "فيديو المحل",
  document: "السجل التجاري أو رخصة المحل",
};

const CHECKS: Record<Kind, string[]> = {
  IDENTITY: [
    "الاسم على الهوية يطابق اسم صاحب الحساب",
    "الوجه في الصورة الشخصية هو نفسه في الهوية",
    "الهوية سليمة وغير معدّلة، والكتابة مقروءة",
  ],
  LOCATION: [
    "اللافتة تُظهر اسم المتجر نفسه",
    "بداية الفيديو في الشارع أو السوق المختار",
    "داخل المحل يناسب نوع البضاعة المعروضة",
    "موقع التصوير على الخريطة داخل السوق",
  ],
};

const REJECT_REASONS: Record<Kind, string[]> = {
  IDENTITY: [
    "الصور غير واضحة أو مقصوصة",
    "الاسم على الهوية لا يطابق اسم الحساب",
    "الصورة الشخصية لا تطابق صورة الهوية",
    "الهوية غير صالحة",
  ],
  LOCATION: [
    "الفيديو لا يُظهر لافتة المحل واسمه",
    "المحل لا يطابق السوق المختار",
    "الفيديو غير واضح أو لا يُظهر المحل من الداخل",
    "يبدو الفيديو من مكان آخر",
  ],
};

const selectClass = "h-10 rounded-xl border border-line bg-surface px-3 text-sm";
const chip = "rounded-lg px-3 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-50";

/** Review queue for merchant verification evidence, oldest request first. */
export function VerificationsTab() {
  const [status, setStatus] = useState("PENDING");
  const [kind, setKind] = useState("");
  const [data, setData] = useState<Page<AdminVerification> | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  const load = async () => {
    setError("");
    try {
      setData(
        await adminFetch<Page<AdminVerification>>(`/admin/verifications${toQuery({ status, kind: kind || undefined, pageSize: 50 })}`),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, kind]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOpenId("");
          }}
          className={selectClass}
        >
          <option value="PENDING">بانتظار المراجعة</option>
          <option value="APPROVED">مقبولة</option>
          <option value="REJECTED">مرفوضة</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
          <option value="">كل الأنواع</option>
          <option value="IDENTITY">توثيق الهوية</option>
          <option value="LOCATION">توثيق المحل</option>
        </select>
      </div>
      <FormError message={error} />
      {data?.items.length === 0 && (
        <EmptyState icon="✅" title={status === "PENDING" ? "لا توجد طلبات بانتظار المراجعة" : "لا توجد طلبات"} />
      )}
      {data?.items.map((r) => (
        <article key={r.id} className="rounded-card bg-surface p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.kind === "IDENTITY" ? "bg-sand text-ink" : "bg-brand-50 text-brand-700"}`}>
                  {KIND_LABELS[r.kind]}
                </span>
                <Link href={webUrl(`/stores/${r.store.slug}`)} target="_blank" className="font-bold hover:text-brand-700">
                  {r.store.name}
                </Link>
                <span className="text-xs text-muted">المستوى الحالي: {LEVELS[r.store.earnedLevel].name}</span>
                {r.store._count.verificationRequests > 0 && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                    {r.store._count.verificationRequests} رفض سابق
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs leading-6 text-muted">
                {r.store.market ? `${r.store.market.name}، ` : ""}
                {r.store.governorate.name} · المالك: {r.store.owner.name} ·{" "}
                <bdi dir="ltr">{displayPhone(r.store.owner.phone)}</bdi> · أُرسل {timeAgo(r.createdAt)}
                {r.reviewedAt && (
                  <>
                    {" "}
                    · راجعه {r.reviewer?.name ?? "—"} {timeAgo(r.reviewedAt)}
                  </>
                )}
              </div>
              {r.rejectReason && <p className="mt-1 text-sm text-danger">سبب الرفض: {r.rejectReason}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpenId(openId === r.id ? "" : r.id)}
              className={`${chip} ${openId === r.id ? "text-muted ring-line" : "bg-ink text-canvas ring-ink"}`}
            >
              {openId === r.id ? "إغلاق" : r.status === "PENDING" ? "مراجعة" : "عرض الأدلة"}
            </button>
          </div>
          {openId === r.id && (
            <ReviewPanel
              request={r}
              onDone={() => {
                setOpenId("");
                load();
              }}
            />
          )}
        </article>
      ))}
    </div>
  );
}

function ReviewPanel({ request: r, onDone }: { request: AdminVerification; onDone: () => void }) {
  const [urls, setUrls] = useState<Partial<Record<Slot, string>>>({});
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Evidence is fetched with the admin session and shown from memory; nothing is cached on disk
  useEffect(() => {
    if (r.purgedAt) return;
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      for (const file of r.files) {
        try {
          const url = URL.createObjectURL(await adminBlob(`/admin/verifications/${r.id}/files/${file.slot}`));
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          created.push(url);
          setUrls((prev) => ({ ...prev, [file.slot]: url }));
        } catch (e) {
          if (!cancelled) setLoadError(e instanceof Error ? e.message : "تعذّر تحميل الملفات");
        }
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [r.id, r.files, r.purgedAt]);

  async function decide(decision: "APPROVE" | "REJECT") {
    setError("");
    if (decision === "REJECT" && reason.trim().length < 5) return setError("اختر سبب الرفض أو اكتبه");
    if (decision === "APPROVE" && !confirm(`قبول ${KIND_LABELS[r.kind]} لمتجر «${r.store.name}»؟`)) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/verifications/${r.id}`, {
        audience: "admin",
        method: "PATCH",
        body: { decision, ...(decision === "REJECT" ? { reason: reason.trim() } : {}) },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ القرار");
      setBusy(false);
    }
  }

  const images = r.files.filter((f) => f.type.startsWith("image/"));
  const video = r.files.find((f) => f.slot === "video");
  const minutesBeforeSend =
    r.capturedAt !== null
      ? Math.max(0, Math.round((new Date(r.createdAt).getTime() - new Date(r.capturedAt).getTime()) / 60_000))
      : null;

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4">
      {r.purgedAt && <p className="text-sm text-muted">حُذفت ملفات هذا الطلب بعد انتهاء مدة الاحتفاظ.</p>}
      <FormError message={loadError} />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {video && !r.purgedAt && (
            <figure>
              {urls.video ? (
                <video src={urls.video} controls playsInline className="aspect-video w-full rounded-xl bg-ink" />
              ) : (
                <div className="aspect-video w-full animate-pulse rounded-xl bg-sand" />
              )}
              <figcaption className="mt-1 text-xs text-muted">{SLOT_LABELS.video}</figcaption>
            </figure>
          )}
          {images.length > 0 && !r.purgedAt && (
            <div className="grid gap-3 sm:grid-cols-3">
              {images.map((f) => (
                <figure key={f.slot}>
                  {urls[f.slot] ? (
                    <a href={urls[f.slot]} target="_blank" rel="noopener noreferrer">
                      <img
                        src={urls[f.slot]}
                        alt={SLOT_LABELS[f.slot]}
                        className="aspect-[4/3] w-full rounded-xl bg-sand object-contain ring-1 ring-line"
                      />
                    </a>
                  ) : (
                    <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-sand" />
                  )}
                  <figcaption className="mt-1 text-xs text-muted">{SLOT_LABELS[f.slot]}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-3 text-sm">
          <div className="rounded-xl bg-sand p-3 leading-7">
            <div>
              <span className="text-muted">اسم الحساب: </span>
              <span className="font-bold">{r.store.owner.name}</span>
            </div>
            <div>
              <span className="text-muted">اسم المتجر: </span>
              <span className="font-bold">{r.store.name}</span>
            </div>
            <div>
              <span className="text-muted">السوق: </span>
              {r.store.market?.name ?? "غير مدرج"}، {r.store.governorate.name}
            </div>
            {r.store.address && (
              <div>
                <span className="text-muted">العنوان: </span>
                {r.store.address}
              </div>
            )}
          </div>

          {r.kind === "LOCATION" && r.latitude !== null && r.longitude !== null && (
            <div className="rounded-xl bg-sand p-3 leading-7">
              <GeoCheckLine request={r} />
              <div className="text-muted">
                دقة GPS: ±{Math.round(r.accuracyMeters ?? 0)} م
                {minutesBeforeSend !== null && ` · صُوّر قبل الإرسال بـ${minutesBeforeSend} دقيقة`}
              </div>
              <a
                href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-700"
              >
                فتح موقع التصوير على الخريطة ←
              </a>
            </div>
          )}

          <div>
            <div className="mb-1 font-bold">تحقّق من:</div>
            <ul className="space-y-1 text-muted">
              {CHECKS[r.kind].map((check) => (
                <li key={check}>☐ {check}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {r.status === "PENDING" && (
        <div className="space-y-2 rounded-xl p-3 ring-1 ring-line">
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS[r.kind].map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setReason(text)}
                className={`${chip} ${reason === text ? "bg-danger text-white ring-danger" : "text-muted ring-line"}`}
              >
                {text}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="سبب الرفض (يظهر للتاجر)"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
          />
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => decide("APPROVE")} className={`${chip} bg-olive-500 px-5 py-2 text-sm text-white ring-olive-500`}>
              قبول
            </button>
            <button type="button" disabled={busy} onClick={() => decide("REJECT")} className={`${chip} px-5 py-2 text-sm text-danger ring-danger/30`}>
              رفض مع السبب
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeoCheckLine({ request: r }: { request: AdminVerification }) {
  if (r.geoCheck === "INSIDE") {
    return (
      <div className="font-bold text-olive-700">
        ✓ داخل حدود {r.store.market?.name} (يبعد {r.distanceMeters} م عن مركزه)
      </div>
    );
  }
  if (r.geoCheck === "OUTSIDE") return <div className="font-bold text-danger">✗ خارج حدود السوق</div>;
  return <div className="font-bold text-brand-700">⚠ لا توجد حدود مسجلة لهذا السوق، تحقق من الخريطة يدوياً</div>;
}
