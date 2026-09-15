import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { env } from '../env';
import { readAudience } from './request';

const SKIP_CSRF = 'skip-csrf';
/** For server-to-server callbacks (e.g. signed payment webhooks). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

/**
 * State-changing requests must carry X-Client (which forces a CORS preflight, so other
 * sites cannot forge it) and, when the browser sends an Origin, it must belong to that
 * interface. Together with SameSite cookies this blocks cross-site request forgery.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [ctx.getHandler(), ctx.getClass()])) return true;

    const audience = readAudience(req);
    if (!audience) throw new ForbiddenException('طلب غير مسموح');
    const origin = req.headers.origin;
    if (origin && !env.origins[audience].includes(origin)) {
      throw new ForbiddenException('مصدر الطلب غير مسموح');
    }
    return true;
  }
}
