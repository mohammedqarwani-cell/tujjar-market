import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = { sub: string; role: 'ADMIN' | 'MERCHANT' | 'USER' };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // ملاحظة: إذا لم تستخدم ConfigModule فالقيمة من .env لن تُحمَّل تلقائياً،
      // لذلك نستخدم fallback "dev-secret"
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // هذا الكائن سيصبح req.user
    return { sub: payload.sub, role: payload.role };
  }
}
