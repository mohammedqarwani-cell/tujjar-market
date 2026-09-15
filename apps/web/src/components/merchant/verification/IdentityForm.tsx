"use client";

import { useState } from "react";
import { merchantFetch } from "@lib/session";
import { compressImage } from "@lib/image";
import { FormError, SubmitButton } from "@components/forms/fields";
import { EvidencePhoto } from "./EvidencePhoto";

const SLOTS = [
  { key: "idFront", label: "وجه الهوية", hint: "البطاقة كاملة داخل الصورة والكتابة مقروءة", capture: "environment" },
  { key: "idBack", label: "ظهر الهوية", hint: "بدون انعكاس ضوء أو أصابع فوق البيانات", capture: "environment" },
  { key: "selfie", label: "صورة شخصية مع الهوية", hint: "امسك الهوية بجانب وجهك، والوجه واضح", capture: "user" },
] as const;

type Slot = (typeof SLOTS)[number]["key"];

export function IdentityForm({ ownerName, onSubmitted }: { ownerName: string; onSubmitted: () => void }) {
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (SLOTS.some((s) => !files[s.key])) return setError("صوّر الصور الثلاث قبل الإرسال");
    setPending(true);
    try {
      const form = new FormData();
      for (const { key } of SLOTS) {
        // Keeps the ID readable while cutting upload size on slow connections
        form.append(key, await compressImage(files[key]!, 2000, 0.9), `${key}.webp`);
      }
      await merchantFetch("/merchant/verification/identity", { method: "POST", body: form });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الصور");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card bg-surface p-5 ring-1 ring-line" noValidate>
      <div>
        <h2 className="text-lg font-bold">الخطوة 1: توثيق الهوية</h2>
        <p className="mt-1 text-sm leading-7 text-muted">
          يجب أن يطابق الاسم على الهوية اسم الحساب: <span className="font-bold text-ink">{ownerName}</span>. نراجع الطلبات
          عادةً خلال يوم عمل.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {SLOTS.map((s) => (
          <EvidencePhoto
            key={s.key}
            label={s.label}
            hint={s.hint}
            capture={s.capture}
            file={files[s.key]}
            onChange={(file) => setFiles((prev) => ({ ...prev, [s.key]: file }))}
          />
        ))}
      </div>
      <p className="rounded-xl bg-sand px-3 py-2 text-xs leading-6 text-muted">
        🔒 تُشفَّر الصور فور وصولها ولا يراها إلا فريق المراجعة، وكل اطلاع عليها مسجّل.
      </p>
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="جارِ رفع الصور…" className="w-full sm:w-auto">
        إرسال للمراجعة
      </SubmitButton>
    </form>
  );
}
