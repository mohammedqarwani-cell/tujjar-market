import { isIP } from 'net';
import type { Request } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by ProxySecretMiddleware once this request proved it came through our own proxy */
    proxyVerified?: boolean;
  }
}

export type Audience = 'web' | 'merchant' | 'admin';
export const AUDIENCES: Audience[] = ['web', 'merchant', 'admin'];

/** Each frontend identifies itself with X-Client; sessions never cross interfaces. */
export function readAudience(req: Request): Audience | null {
  const raw = req.headers['x-client'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return AUDIENCES.includes(value as Audience) ? (value as Audience) : null;
}

/**
 * The visitor's address, used for every per-IP limit.
 *
 * Our own proxy passes it in X-Tujjar-Client-IP, which is believed only when the request also
 * carried the proxy secret; anyone forging that header without the secret is ignored. Otherwise
 * the connection decides (`trust proxy` controls how far X-Forwarded-For is followed).
 */
export function clientIp(req: Request): string {
  if (req.proxyVerified) {
    const header = req.headers['x-tujjar-client-ip'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    if (value && isIP(value)) return value;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function requestMeta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
  };
}

export type RequestMeta = ReturnType<typeof requestMeta>;
