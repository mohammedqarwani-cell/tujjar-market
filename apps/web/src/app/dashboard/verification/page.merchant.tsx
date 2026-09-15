"use client";

import { useSession } from "@lib/session";
import { timeAgo } from "@lib/format";
import {
  useAuthData,
  type MerchantVerification,
  type VerificationKind,
  type VerificationRequestSummary,
  type VerificationStatus,
} from "@lib/merchant";
import { LEVELS, LEVEL_ORDER, atLeast, formatDate } from "@lib/verification";
import { FormError } from "@components/forms/fields";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { IdentityForm } from "@components/merchant/verification/IdentityForm";
import { ShopVideoForm } from "@components/merchant/verification/ShopVideoForm";

export default function VerificationPage() {
  const { user } = useSession("merchant");
  const { data, error, reload } = useAuthData<MerchantVerification>("/merchant/verification");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">توثيق المتجر</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          كل مستوى يزيد ثقة الزبائن بمتجرك ويفتح لك مزايا أكثر. التوثيق كله من موبايلك، بدون زيارات أو رسوم.
        </p>
      </div>
      <FormError message={error} />
      {data && user ? (
        <>
          <Ladder data={data} />
          <NextStep data={data} ownerName={user.name} storeName={user.store?.name ?? ""} onSubmitted={reload} />
          <History requests={data.requests} />
        </>
      ) : (
        !error && <div className="h-72 animate-pulse rounded-card bg-surface ring-1 ring-line" />
      )}
    </div>
  );
}

function Ladder({ data }: { data: MerchantVerification }) {
  return (
    <section className="rounded-card bg-surface p-5 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">مستوى متجرك: {LEVELS[data.level].name}</h2>
        <span className="text-sm text-muted">
          المنتجات: {data.productCount}
          {data.productLimit !== null ? ` من ${data.productLimit}` : " (بلا حدود)"}
        </span>
      </div>
      {data.productLimit !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${Math.min(100, (data.productCount / data.productLimit) * 100)}%` }}
          />
        </div>
      )}

      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LEVEL_ORDER.map((level) => {
          const done = atLeast(data.earnedLevel, level);
          return (
            <li key={level} className={`rounded-xl p-3 ring-1 ${done ? "bg-olive-50 ring-olive-100" : "bg-sand/60 ring-line"}`}>
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span className={done ? "text-olive-600" : "text-muted"}>{done ? "✓" : "○"}</span>
                {LEVELS[level].name}
                <VerifiedMark level={level} size={15} />
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{LEVELS[level].unlocks}</p>
            </li>
          );
        })}
      </ol>

      {data.expiresAt && (
        <p className="mt-3 text-xs text-muted">توثيق المحل ساري حتى {formatDate(data.expiresAt)}، ويُجدَّد سنوياً بفيديو جديد.</p>
      )}
      {data.badgeSuspended && (
        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium leading-7 text-danger">
          شارة التوثيق موقوفة مؤقتاً بسبب بلاغات مؤكدة من الزبائن. تواصل مع إدارة المنصة لمراجعة وضع متجرك.
        </p>
      )}
    </section>
  );
}

function NextStep({
  data,
  ownerName,
  storeName,
  onSubmitted,
}: {
  data: MerchantVerification;
  ownerName: string;
  storeName: string;
  onSubmitted: () => void;
}) {
  const latest = (kind: VerificationKind) => data.requests.find((r) => r.kind === kind);
  if (data.badgeSuspended) return null;

  if (data.earnedLevel === "REGISTERED") {
    if (data.identity.pending) {
      return <Notice text="وصلتنا صور هويتك وهي قيد المراجعة الآن. سيرتفع مستوى متجرك فور الموافقة." />;
    }
    return (
      <>
        <Rejection request={latest("IDENTITY")} />
        <IdentityForm ownerName={ownerName} onSubmitted={onSubmitted} />
      </>
    );
  }

  if (data.location.pending) return <Notice text="وصلنا فيديو المحل وهو قيد المراجعة الآن." />;
  if (data.location.canSubmit) {
    return (
      <>
        <Rejection request={latest("LOCATION")} />
        {!data.market && (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-7 text-brand-900 ring-1 ring-brand-100">
            متجرك غير مرتبط بسوق. إذا كان محلك داخل سوق مدرج، اختره من إعدادات المتجر قبل التصوير.
          </p>
        )}
        <ShopVideoForm storeName={storeName} marketName={data.market?.name ?? null} onSubmitted={onSubmitted} />
      </>
    );
  }

  if (data.earnedLevel === "PREMIUM") return <Notice done text="متجرك في أعلى مستوى توثيق. شكراً لثقتك." />;
  return (
    <Notice
      done
      text={`متجرك «محل موثّق». المستوى التالي «تاجر مميز» يتم بزيارة ميدانية ضمن الاشتراك المميز (قريباً).${
        data.location.reason ? ` ${data.location.reason}.` : ""
      }`}
    />
  );
}

function Rejection({ request }: { request?: VerificationRequestSummary }) {
  if (request?.status !== "REJECTED") return null;
  return (
    <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm leading-7 text-danger">
      <span className="font-bold">لم نقبل طلبك السابق: </span>
      {request.rejectReason}. صحّح ذلك وأعد الإرسال.
    </div>
  );
}

function Notice({ text, done = false }: { text: string; done?: boolean }) {
  return (
    <div
      className={`rounded-card p-5 text-sm leading-7 ring-1 ${done ? "bg-olive-50 text-olive-700 ring-olive-100" : "bg-brand-50 text-brand-900 ring-brand-100"}`}
    >
      {done ? "✓ " : "⏳ "}
      {text}
    </div>
  );
}

const KIND_LABELS: Record<VerificationKind, string> = { IDENTITY: "توثيق الهوية", LOCATION: "توثيق المحل" };
const STATUS_LABELS: Record<VerificationStatus, [string, string]> = {
  PENDING: ["قيد المراجعة", "bg-brand-50 text-brand-700"],
  APPROVED: ["مقبول", "bg-olive-50 text-olive-700"],
  REJECTED: ["مرفوض", "bg-danger/10 text-danger"],
};

function History({ requests }: { requests: VerificationRequestSummary[] }) {
  if (!requests.length) return null;
  return (
    <section className="rounded-card bg-surface p-5 ring-1 ring-line">
      <h2 className="font-bold">سجل الطلبات</h2>
      <ul className="mt-3 divide-y divide-line">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="flex-1 font-medium">{KIND_LABELS[r.kind]}</span>
            <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_LABELS[r.status][1]}`}>
              {STATUS_LABELS[r.status][0]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
