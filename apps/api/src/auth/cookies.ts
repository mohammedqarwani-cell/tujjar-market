import type { CookieOptions, Response } from 'express';
import { env } from '../env';
import type { Audience } from '../common/request';
import { ACCESS_TTL_SEC } from './roles';

const PREFIX: Record<Audience, string> = {
  web: 'tj_web',
  merchant: 'tj_mer',
  admin: 'tj_adm',
};

export const accessCookie = (aud: Audience) => `${PREFIX[aud]}_at`;
export const refreshCookie = (aud: Audience) => `${PREFIX[aud]}_rt`;

// The refresh token is only ever sent to the auth endpoints, wherever the API is mounted
const REFRESH_PATH = `${env.cookiePathPrefix}/auth`;

function base(aud: Audience): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: aud === 'admin' ? 'strict' : 'lax',
    domain: env.cookieDomain,
  };
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export function setAuthCookies(
  res: Response,
  aud: Audience,
  tokens: IssuedTokens,
) {
  res.cookie(accessCookie(aud), tokens.accessToken, {
    ...base(aud),
    path: '/',
    maxAge: ACCESS_TTL_SEC * 1000,
  });
  res.cookie(refreshCookie(aud), tokens.refreshToken, {
    ...base(aud),
    path: REFRESH_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response, aud: Audience) {
  res.clearCookie(accessCookie(aud), { ...base(aud), path: '/' });
  res.clearCookie(refreshCookie(aud), { ...base(aud), path: REFRESH_PATH });
}
