import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const KEY = 'rate-limit';
type Limit = { max: number; windowSec: number };

/** Allows `max` requests per client IP within `windowSec` for the decorated route. */
export const RateLimit = (max: number, windowSec: number) =>
  SetMetadata(KEY, { max, windowSec } satisfies Limit);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const limit = this.reflector.get<Limit | undefined>(KEY, ctx.getHandler());
    if (!limit) return true;

    const req = ctx.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip ?? 'unknown').trim();
    const key = `${ctx.getClass().name}.${ctx.getHandler().name}:${ip}`;
    const now = Date.now();

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + limit.windowSec * 1000 });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    if (entry.count >= limit.max) {
      throw new HttpException('محاولات كثيرة، حاول لاحقاً', HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count++;
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
