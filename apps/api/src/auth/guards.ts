import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Role } from '@prisma/client';
import type { AuthUser } from './current-user.decorator';

const ROLES_KEY = 'roles';
const ALLOW_WITHOUT_MFA = 'allow-without-mfa';

/** Lets a signed-in admin reach two-factor setup before enabling it. */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException('سجّل الدخول للمتابعة');
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('لا تملك صلاحية لهذا الإجراء');
    return true;
  }
}

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (user?.aud !== 'admin' || user.mfa) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA, [ctx.getHandler(), ctx.getClass()])) return true;
    throw new ForbiddenException({ statusCode: 403, message: 'فعّل المصادقة الثنائية للمتابعة', code: 'MFA_REQUIRED' });
  }
}

/** Requires a valid session for the calling interface, optionally limited to roles. */
export const Auth = (...roles: Role[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(JwtAuthGuard, RolesGuard, MfaGuard));
