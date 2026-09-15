import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { sha256 } from '../common/crypto';
import type { Audience, RequestMeta } from '../common/request';
import { REFRESH_TTL_MS } from './roles';

/** Two tabs refreshing at once shouldn't look like a stolen token. */
const ROTATION_GRACE_MS = 30_000;

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async issue(
    user: { id: string; role: Role },
    aud: Audience,
    meta: RequestMeta,
    opts: { mfa: boolean; familyId?: string },
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS[aud]);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        audience: aud,
        tokenHash: sha256(refreshToken),
        familyId: opts.familyId ?? randomUUID(),
        mfa: opts.mfa,
        expiresAt: refreshExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, aud, sid: session.id, mfa: opts.mfa });
    return { accessToken, refreshToken, refreshExpiresAt, sessionId: session.id };
  }

  async rotate(rawToken: string, aud: Audience, meta: RequestMeta) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!session || session.audience !== aud) throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول مجدداً');

    if (session.revokedAt) {
      const withinGrace = session.replacedById && Date.now() - session.revokedAt.getTime() < ROTATION_GRACE_MS;
      if (!withinGrace) {
        // A revoked refresh token was replayed: assume theft and end every session in the family
        await this.prisma.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.log({
          actorId: session.userId,
          action: 'auth.refresh_token_reuse',
          entityType: 'session',
          entityId: session.id,
          ip: meta.ip,
        });
        throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول مجدداً');
      }
    }

    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول مجدداً');
    }

    const next = await this.issue(session.user, aud, meta, { mfa: session.mfa, familyId: session.familyId });
    if (!session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), replacedById: next.sessionId },
      });
    }
    return next;
  }

  async revokeByToken(rawToken: string) {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }
}
