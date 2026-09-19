import type { Request } from 'express';

export type Audience = 'web' | 'merchant' | 'admin';
export const AUDIENCES: Audience[] = ['web', 'merchant', 'admin'];

/** Each frontend identifies itself with X-Client; sessions never cross interfaces. */
export function readAudience(req: Request): Audience | null {
  const raw = req.headers['x-client'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return AUDIENCES.includes(value as Audience) ? (value as Audience) : null;
}

/** `trust proxy` decides whether X-Forwarded-For is honoured. */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function requestMeta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
  };
}

export type RequestMeta = ReturnType<typeof requestMeta>;
