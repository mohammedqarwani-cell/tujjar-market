"use client";

/** Short confirmations ("أُضيف إلى المفضلة") shown by <Toaster />, from anywhere in the app. */
export type Toast = { id: number; text: string; icon?: string };

const EVENT = "tujjar-toast";
let seq = 0;

export function toast(text: string, icon?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: ++seq, text, icon } }));
}

export function onToast(cb: (t: Toast) => void) {
  const listener = (e: Event) => cb((e as CustomEvent<Toast>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** A short vibration on phones that support it, for taps that change something. */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
