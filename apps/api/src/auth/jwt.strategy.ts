import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { readAudience, type Audience } from '../common/request';
import { accessCookie } from './cookies';
import type { AuthUser } from './current-user.decorator';
import { ROLE_AUDIENCE } from './roles';

type JwtPayload = {
  sub: string;
  role: Role;
  aud: Audience;
  sid: string;
  mfa?: boolean;
};

type TokenExtractor = (req: Request) => string | null;
const bearer = (
  ExtractJwt as { fromAuthHeaderAsBearerToken(): TokenExtractor }
).fromAuthHeaderAsBearerToken();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    // passport-jwt ships no type definitions, so its Strategy base is untyped
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // Cookie for browsers, Bearer for future native apps; both must name their interface
      jwtFromRequest: (req: Request) => {
        const aud = readAudience(req);
        if (!aud) return null;
        return (
          bearer(req) ??
          (req.cookies as Record<string, string | undefined> | undefined)?.[
            accessCookie(aud)
          ] ??
          null
        );
      },
      ignoreExpiration: false,
      secretOrKey: env.jwtAccessSecret,
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthUser> {
    const aud = readAudience(req);
    if (
      !aud ||
      payload.aud !== aud ||
      !ROLE_AUDIENCE[aud].includes(payload.role)
    ) {
      throw new UnauthorizedException('سجّل الدخول للمتابعة');
    }
    // Admin sessions are checked on every request so revocation takes effect immediately
    if (aud === 'admin') {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول مجدداً');
      }
    }
    return {
      id: payload.sub,
      role: payload.role,
      aud,
      sid: payload.sid,
      mfa: !!payload.mfa,
    };
  }
}
