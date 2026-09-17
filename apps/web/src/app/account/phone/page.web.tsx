"use client";

import Link from "next/link";
import { useInterfaceSession } from "@components/notifications/useInterfaceSession";
import { ChangePhoneForm } from "@components/account/ChangePhoneForm";

export default function BuyerPhonePage() {
  const { user } = useInterfaceSession();
  if (!user) return <div className="mx-auto h-[50vh] max-w-xl animate-pulse px-4 py-10" aria-busy="true" />;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 pb-24 md:pb-10">
      <Link href="/account" className="text-sm text-muted hover:text-ink">→ حسابي</Link>
      <h1 className="mb-5 mt-2 text-2xl font-bold">تغيير رقم الموبايل</h1>
      <ChangePhoneForm audience="web" currentPhone={user.phone} />
    </div>
  );
}
