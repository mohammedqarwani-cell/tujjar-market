import type { NotificationCategory, Role } from '@prisma/client';

export type ChannelPrefs = { inApp: boolean; push: boolean };
export type PrefsMap = Partial<Record<NotificationCategory, ChannelPrefs>>;

type CategoryInfo = {
  label: string;
  description: string;
  defaults: ChannelPrefs;
  /** Account notices always stay in the app so nobody misses a decision about their account */
  inAppLocked?: boolean;
  /** Marketing-style: pushes are capped per day and held back at night */
  marketing?: boolean;
};

export const CATEGORY_INFO: Record<NotificationCategory, CategoryInfo> = {
  ACCOUNT: {
    label: 'حسابي',
    description: 'قرارات التوثيق، حالة المتجر والمنتجات، الردود على تقييماتك، ونتائج بلاغاتك',
    defaults: { inApp: true, push: true },
    inAppLocked: true,
  },
  REVIEWS: {
    label: 'تقييمات متجري',
    description: 'عندما يقيّم زبون متجرك',
    defaults: { inApp: true, push: true },
  },
  FAVORITES: {
    label: 'المفضلة',
    description: 'انخفاض سعر منتج في مفضلتك أو توفره من جديد',
    defaults: { inApp: true, push: true },
    marketing: true,
  },
  FOLLOWING: {
    label: 'المتاجر التي أتابعها',
    description: 'المنتجات الجديدة والعروض من المتاجر التي تتابعها',
    defaults: { inApp: true, push: true },
    marketing: true,
  },
  PROMOTIONS: {
    label: 'العروض والجديد',
    description: 'عروض المواسم، الأسواق الجديدة، وأخبار تُجّار ماركت',
    defaults: { inApp: true, push: true },
    marketing: true,
  },
  INVITES: {
    label: 'الدعوات والتذكيرات',
    description: 'دعوة لتقييم متجر تواصلت معه، أو لتوثيق متجرك وتجربة ميزات جديدة',
    defaults: { inApp: true, push: true },
    marketing: true,
  },
  MODERATION: {
    label: 'طوابير المراجعة',
    description: 'طلبات توثيق وبلاغات وتقييمات تنتظر المراجعة',
    defaults: { inApp: true, push: true },
  },
};

export const ROLE_CATEGORIES: Record<Role, NotificationCategory[]> = {
  BUYER: ['ACCOUNT', 'FAVORITES', 'FOLLOWING', 'PROMOTIONS', 'INVITES'],
  MERCHANT: ['ACCOUNT', 'REVIEWS', 'PROMOTIONS', 'INVITES'],
  ADMIN: ['ACCOUNT', 'MODERATION'],
  MODERATOR: ['ACCOUNT', 'MODERATION'],
  FIELD_AGENT: ['ACCOUNT'],
};

/** Marketing pushes allowed per user per rolling 24 hours */
export const MARKETING_PUSH_DAILY_CAP = 3;
/** Damascus local hours (inclusive start, exclusive end) when marketing pushes are sent */
export const MARKETING_PUSH_HOURS = { from: 9, to: 22 };

export function effectivePrefs(role: Role, stored: unknown, category: NotificationCategory): ChannelPrefs {
  if (!ROLE_CATEGORIES[role].includes(category)) return { inApp: false, push: false };
  const info = CATEGORY_INFO[category];
  const saved = (stored && typeof stored === 'object' ? (stored as PrefsMap)[category] : undefined) ?? info.defaults;
  return {
    inApp: info.inAppLocked ? true : saved.inApp !== false,
    push: saved.push !== false,
  };
}

export function damascusHour(date = new Date()) {
  return (date.getUTCHours() + 3) % 24;
}
