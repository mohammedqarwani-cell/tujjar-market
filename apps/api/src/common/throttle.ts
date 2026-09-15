import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { clientIp } from './request';

/**
 * Per-route request limits per client IP.
 *
 * Replaces @nestjs/throttler, which has no NestJS 12 release yet. Counters live in memory,
 * so running several API instances needs a shared store (e.g. Redis) behind this guard.
 */
type Limit = { limit: number; ttl: number };

const KEY = 'throttle';
const DEFAULT_LIMIT: Limit = { limit: 120, ttl: 60_000 };
const MAX_TRACKED_KEYS = 50_000;

/** Same shape as @nestjs/throttler's decorator: `@Throttle({ default: { limit, ttl } })`. */
export const Throttle = (options: { default: Limit }) => SetMetadata(KEY, options.default);

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;

    const { limit, ttl } =
      this.reflector.getAllAndOverride<Limit | undefined>(KEY, [ctx.getHandler(), ctx.getClass()]) ??
      DEFAULT_LIMIT;
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const now = Date.now();
    const key = `${ctx.getClass().name}.${ctx.getHandler().name}:${clientIp(req)}`;
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + ttl };
      this.hits.set(key, entry);
      if (this.hits.size > MAX_TRACKED_KEYS) this.prune(now);
    }
    entry.count++;

    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('RateLimit-Limit', limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - entry.count));
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (entry.count > limit) {
      res.setHeader('Retry-After', resetSeconds);
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'محاولات كثيرة، حاول لاحقاً' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
