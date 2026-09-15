import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from '../env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { ACCESS_TTL_SEC } from './roles';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.jwtAccessSecret,
      signOptions: { expiresIn: ACCESS_TTL_SEC, algorithm: 'HS256' },
    }),
  ],
  providers: [AuthService, JwtStrategy, OtpService, SessionService],
  controllers: [AuthController],
})
export class AuthModule {}
