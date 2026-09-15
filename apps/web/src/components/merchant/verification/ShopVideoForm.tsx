"use client";

import { useEffect, useRef, useState } from "react";
import { merchantFetch } from "@lib/session";
import { compressImage } from "@lib/image";
import { FormError, SubmitButton } from "@components/forms/fields";
import { EvidencePhoto } from "./EvidencePhoto";

const MIN_SECONDS = 8;
const MAX_SECONDS = 30;
/** Same limit as the API: less precise GPS readings are refused */
const MAX_ACCURACY_M = 150;

type Fix = { latitude: number; longitude: number; accuracy: number };
type Recording = { blob: Blob; url: string; capturedAt: string; fix: Fix };
type Phase = "idle" | "starting" | "recording" | "review" | "sending";

const toFix = (p: GeolocationPosition): Fix => ({
  latitude: p.coords.latitude,
  longitude: p.coords.longitude,
  accuracy: p.coords.accuracy,
});

function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("المتصفح لا يدعم تحديد الموقع"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toFix(p)),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "اسمح بالوصول لموقعك من إعدادات المتصفح، فهو ضروري لتوثيق المحل"
              : "تعذّر تحديد موقعك. فعّل GPS وحاول مجدداً",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

function cameraError(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "اسمح بالوصول للكاميرا من إعدادات المتصفح ثم حاول مجدداً";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "لا توجد كاميرا على هذا الجهاز. افتح بوابة التجار من موبايلك";
  }
  return "تعذّر فتح الكاميرا";
}

function pickMimeType() {
  const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

const clock = (s: number) => `00:${String(s).padStart(2, "0")}`;

/**
 * Records the shop video live in the page (a gallery file can't be chosen) and captures GPS at the
 * same time, like Google Business Profile video verification.
 */
export function ShopVideoForm({
  storeName,
  marketName,
  onSubmitted,
}: {
  storeName: string;
  marketName: string | null;
  onSubmitted: () => void;
}) {
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const watchRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [documentFile, setDocumentFile] = useState<File>();
  const [error, setError] = useState("");

  const release = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  useEffect(() => release, []);

  useEffect(() => {
    if (!recording) return;
    return () => URL.revokeObjectURL(recording.url);
  }, [recording]);

  useEffect(() => {
    if (phase !== "recording") return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS && recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setError("متصفحك لا يدعم التصوير. افتح بوابة التجار من Chrome أو Safari على موبايلك");
    }
    setPhase("starting");
    try {
      // Location first: a shop video is only evidence when we know where it was recorded
      fixRef.current = await locate();
    } catch (e) {
      setPhase("idle");
      return setError(e instanceof Error ? e.message : "تعذّر تحديد موقعك");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      setPhase("idle");
      return setError(cameraError(e));
    }
    streamRef.current = stream;
    if (liveRef.current) {
      liveRef.current.srcObject = stream;
      liveRef.current.play().catch(() => {});
    }
    // Keep the most precise reading taken while walking into the shop
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        if (!fixRef.current || p.coords.accuracy < fixRef.current.accuracy) fixRef.current = toFix(p);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 },
    );

    const mimeType = pickMimeType();
    // About 0.7 Mbit/s keeps a 30-second clip under 3 MB: quick on slow connections and within proxy upload limits
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 700_000 });
    const chunks: Blob[] = [];
    const capturedAt = new Date().toISOString();
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      release();
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
      setRecording({ blob, url: URL.createObjectURL(blob), capturedAt, fix: fixRef.current! });
      setPhase("review");
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setPhase("recording");
  }

  function retake() {
    setRecording(null);
    setSeconds(0);
    setError("");
    setPhase("idle");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!recording) return;
    setError("");
    setPhase("sending");
    try {
      const form = new FormData();
      form.append("video", recording.blob, recording.blob.type.includes("mp4") ? "shop.mp4" : "shop.webm");
      if (documentFile) form.append("document", await compressImage(documentFile, 2000, 0.9), "document.webp");
      form.append("latitude", String(recording.fix.latitude));
      form.append("longitude", String(recording.fix.longitude));
      form.append("accuracy", String(Math.round(recording.fix.accuracy)));
      form.append("capturedAt", recording.capturedAt);
      await merchantFetch("/merchant/verification/location", { method: "POST", body: form });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الفيديو");
      setPhase("review");
    }
  }

  const accuracy = recording ? Math.round(recording.fix.accuracy) : 0;
  const steps = [
    `ابدأ من الشارع: لافتة ${marketName ?? "السوق"} أو معلم قريب`,
    `اقترب من محلك وصوّر الواجهة واسم «${storeName}»`,
    "ادخل وصوّر البضاعة والمكان من الداخل",
  ];

  return (
    <section className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line">
      <div>
        <h2 className="text-lg font-bold">الخطوة 2: توثيق المحل بفيديو</h2>
        <p className="mt-1 text-sm leading-7 text-muted">
          فيديو من {MIN_SECONDS} إلى {MAX_SECONDS} ثانية يُصوَّر مباشرة من هنا، ولا يُقبل فيديو من المعرض. الصوت لا يُسجَّل.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((text, i) => (
          <li key={text} className="flex gap-2 rounded-xl bg-sand px-3 py-2.5 text-sm leading-6">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            {text}
          </li>
        ))}
      </ol>
      <p className="text-xs leading-6 text-muted">
        📍 فعّل الموقع الدقيق (GPS) في الموبايل{marketName ? `، ويجب أن تكون داخل ${marketName} أثناء التصوير` : ""}.
      </p>

      <video
        ref={liveRef}
        muted
        playsInline
        className={phase === "starting" || phase === "recording" ? "aspect-video w-full rounded-xl bg-ink object-cover" : "hidden"}
      />

      {phase === "idle" && (
        <>
          <FormError message={error} />
          <button
            type="button"
            onClick={start}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-bold text-canvas transition hover:bg-brand-900 sm:w-auto sm:px-6"
          >
            <span className="h-3 w-3 rounded-full bg-danger" /> ابدأ التصوير
          </button>
        </>
      )}

      {phase === "starting" && <p className="text-sm text-muted">جارِ تحديد موقعك وفتح الكاميرا…</p>}

      {phase === "recording" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 font-mono text-lg font-bold text-danger" dir="ltr">
            <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
            {clock(seconds)} / {clock(MAX_SECONDS)}
          </span>
          <button
            type="button"
            disabled={seconds < MIN_SECONDS}
            onClick={() => recorderRef.current?.stop()}
            className="h-11 rounded-xl bg-danger px-5 font-bold text-white disabled:opacity-50"
          >
            {seconds < MIN_SECONDS ? `استمر ${MIN_SECONDS - seconds} ثوانٍ…` : "إنهاء التصوير"}
          </button>
        </div>
      )}

      {recording && (phase === "review" || phase === "sending") && (
        <form onSubmit={send} className="space-y-4" noValidate>
          <video src={recording.url} controls playsInline className="aspect-video w-full rounded-xl bg-ink" />
          <p className={`text-sm ${accuracy > MAX_ACCURACY_M ? "font-bold text-danger" : "text-muted"}`}>
            دقة الموقع: ±{accuracy} متر
            {accuracy > MAX_ACCURACY_M ? " — ضعيفة، اقترب من باب المحل وأعد التصوير" : ""}
          </p>
          <div className="max-w-xs">
            <EvidencePhoto
              label="السجل التجاري أو رخصة المحل"
              hint="اختياري، يسرّع المراجعة"
              capture="environment"
              file={documentFile}
              onChange={setDocumentFile}
            />
          </div>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retake}
              disabled={phase === "sending"}
              className="h-12 rounded-xl px-5 font-medium text-muted ring-1 ring-line hover:text-ink disabled:opacity-50"
            >
              إعادة التصوير
            </button>
            <SubmitButton pending={phase === "sending"} pendingLabel="جارِ رفع الفيديو… قد يستغرق دقيقة" className="flex-1 sm:flex-none">
              إرسال للمراجعة
            </SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
