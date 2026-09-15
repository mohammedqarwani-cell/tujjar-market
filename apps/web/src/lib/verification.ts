import type { VerificationLevel } from "./types";

export const LEVEL_ORDER: VerificationLevel[] = ["REGISTERED", "IDENTITY", "LOCATION", "PREMIUM"];

export const atLeast = (level: VerificationLevel, min: VerificationLevel) =>
  LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);

/** What each level proves to buyers and what it unlocks for merchants. */
export const LEVELS: Record<VerificationLevel, { name: string; badge: string; proof: string; unlocks: string }> = {
  REGISTERED: {
    name: "تسجيل",
    badge: "لم يوثّق بعد",
    proof: "رقم الموبايل والواتساب موثّقان برمز، مع تعهّد التاجر بصحة معلوماته",
    unlocks: "حتى 10 منتجات",
  },
  IDENTITY: {
    name: "هوية موثّقة",
    badge: "هوية موثّقة",
    proof: "راجع فريقنا الهوية الشخصية لصاحب المتجر وصورته معها",
    unlocks: "حتى 50 منتجاً",
  },
  LOCATION: {
    name: "محل موثّق",
    badge: "محل موثّق",
    proof: "راجع فريقنا فيديو من داخل المحل مع موقعه داخل السوق، ويُجدَّد سنوياً",
    unlocks: "منتجات بلا حدود وظهور أعلى في البحث",
  },
  PREMIUM: {
    name: "تاجر مميز",
    badge: "تاجر مميز",
    proof: "زار مندوب تُجّار ماركت المحل ميدانياً",
    unlocks: "الإعلانات المميزة",
  },
};

export const isNewStore = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 30 * 86_400_000;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-SY-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
