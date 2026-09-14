"use client";

import { useEffect } from "react";
import { trackView } from "@lib/contact";

export function ViewTracker({ storeSlug, productId }: { storeSlug?: string; productId?: string }) {
  useEffect(() => {
    trackView({ storeSlug, productId });
  }, [storeSlug, productId]);
  return null;
}
