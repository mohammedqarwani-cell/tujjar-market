import type { Role } from '@prisma/client';
import type { Audience } from '../common/request';

/** Which roles may sign in to which interface. */
export const ROLE_AUDIENCE: Record<Audience, Role[]> = {
  web: ['BUYER'],
  merchant: ['MERCHANT'],
  admin: ['ADMIN', 'MODERATOR', 'FIELD_AGENT'],
};

export const REFRESH_TTL_MS: Record<Audience, number> = {
  web: 60 * 24 * 3600_000,
  merchant: 30 * 24 * 3600_000,
  admin: 12 * 3600_000,
};

export const ACCESS_TTL_SEC = 15 * 60;
