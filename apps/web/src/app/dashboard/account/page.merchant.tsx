"use client";

import { useSession } from "@lib/session";
import { ChangePhoneForm } from "@components/account/ChangePhoneForm";

export default function MerchantAccountPage() {
  const { user } = useSession("merchant");
  if (!user) return null;
  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">الحساب</h1>
      <p className="mb-5 text-sm text-muted">{user.name}</p>
      <h2 className="mb-3 font-bold">تغيير رقم الموبايل</h2>
      <ChangePhoneForm audience="merchant" currentPhone={user.phone} isMerchant />
    </div>
  );
}
