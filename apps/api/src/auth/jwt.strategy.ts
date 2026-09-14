import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../env';
import type { AuthUser } from './current-user.decorator';

type JwtPayload = { sub: string; role: AuthUser['role'] };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return { id: payload.sub, role: payload.role };
  }
}
