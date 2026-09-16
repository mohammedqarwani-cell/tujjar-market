"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@lib/session";
import { APP_INTERFACE } from "@lib/urls";

const LOGIN_PATH = { web: "/account/login", merchant: "/login", admin: "/admin/login" } as const;

/** Session of the interface this build serves; anonymous visitors go to that interface's login page. */
export function useInterfaceSession() {
  const session = useSession(APP_INTERFACE);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "anonymous") router.replace(`${LOGIN_PATH[APP_INTERFACE]}?next=${encodeURIComponent(pathname)}`);
  }, [session.status, router, pathname]);

  return { ...session, audience: APP_INTERFACE };
}
