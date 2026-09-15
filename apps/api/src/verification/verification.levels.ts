import type { VerificationLevel } from '@prisma/client';

export const LEVELS: VerificationLevel[] = ['REGISTERED', 'IDENTITY', 'LOCATION', 'PREMIUM'];
export const levelRank = (level: VerificationLevel) => LEVELS.indexOf(level);
export const atLeast = (level: VerificationLevel, min: VerificationLevel) => levelRank(level) >= levelRank(min);
export const maxLevel = (a: VerificationLevel, b: VerificationLevel) => (levelRank(a) >= levelRank(b) ? a : b);

/** How many products a store may list at each public level (null: no limit) */
export const PRODUCT_LIMITS: Record<VerificationLevel, number | null> = {
  REGISTERED: 10,
  IDENTITY: 50,
  LOCATION: null,
  PREMIUM: null,
};

export const DAY_MS = 86_400_000;
/** Shop verification is renewed yearly with a new video */
export const VERIFICATION_VALID_DAYS = 365;
export const RENEWAL_WINDOW_DAYS = 30;
/** This many confirmed reports within the window suspend a store's badge */
export const BADGE_REPORT_THRESHOLD = 3;
export const BADGE_REPORT_WINDOW_DAYS = 90;
/** Evidence of rejected requests is deleted after this many days */
export const REJECTED_FILES_RETENTION_DAYS = 30;
