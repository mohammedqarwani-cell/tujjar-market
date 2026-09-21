import { Injectable, NestMiddleware } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env';

/** The health check is what the host calls before any proxy is in front of us */
const OPEN_PATHS = new Set(['/healthz']);

/** Compares without leaking the length or the position of the first difference. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The API is reached through each interface's own /api proxy, which adds a shared secret.
 * Without it the deployment URL could be called directly with a forged X-Forwarded-For, and
 * every per-IP limit would be meaningless.
 *
 * When PROXY_SECRET is unset (development) nothing changes: requests pass and the client IP
 * keeps coming from the connection.
 */
@Injectable()
export class ProxySecretMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!env.proxySecret) return next();
    // originalUrl, because a middleware sees the path relative to where it is mounted
    const path = (req.originalUrl || req.url).split('?')[0].replace(/\/+$/, '');
    if (req.method === 'GET' && OPEN_PATHS.has(path || '/')) return next();

    const header = req.headers['x-proxy-secret'];
    const given = Array.isArray(header) ? header[0] : header;
    if (!given || !sameSecret(given, env.proxySecret)) {
      res.status(403).json({ statusCode: 403, message: 'طلب غير مسموح' });
      return;
    }

    // Only now may this request's X-Tujjar-Client-IP be believed (see common/request.ts)
    req.proxyVerified = true;
    next();
  }
}
