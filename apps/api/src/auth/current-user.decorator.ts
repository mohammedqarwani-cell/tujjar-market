import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { Audience } from '../common/request';

export type AuthUser = {
  id: string;
  role: Role;
  aud: Audience;
  /** Session id, used to revoke this device */
  sid: string;
  /** True when this session passed two-factor authentication */
  mfa: boolean;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
