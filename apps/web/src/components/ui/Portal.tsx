"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders overlays at the end of <body>. Needed for anything `fixed` opened from the sticky header:
 * its backdrop blur makes the header the containing block, which would squeeze popups into it.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
