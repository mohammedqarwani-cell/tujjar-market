import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '../common/throttle';
import type { Request, Response } from 'express';
import { clientIp, readAudience, requestMeta, type Audience } from '../common/request';
import { AuthService } from './auth.service';
import { LoginDto, RegisterBuyerDto, RegisterMerchantDto, RequestOtpDto, ResetPasswordDto, TotpCodeDto } from './auth.dto';
import { AllowWithoutMfa, Auth } from './guards';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './current-user.decorator';
import { clearAuthCookies, refreshCookie, setAuthCookies } from './cookies';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

const HOUR = 3600_000;

function audienceOf(req: Request, expected?: Audience): Audience {
  const aud = readAudience(req);
  if (!aud || (expected && aud !== expected)) throw new BadRequestException('واجهة غير صحيحة لهذا الطلب');
  return aud;
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private otp: OtpService,
    private sessions: SessionService,
  ) {}

  @Post('otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    audienceOf(req);
    return this.otp.request(dto.phone, dto.purpose, clientIp(req));
  }

  @Post('register/buyer')
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async registerBuyer(@Body() dto: RegisterBuyerDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.auth.registerBuyer(dto, requestMeta(req));
    setAuthCookies(res, audienceOf(req, 'web'), tokens);
    return { user };
  }

  @Post('register/merchant')
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async registerMerchant(@Body() dto: RegisterMerchantDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    audienceOf(req, 'merchant');
    const { tokens, user } = await this.auth.registerMerchant(dto, requestMeta(req));
    setAuthCookies(res, 'merchant', tokens);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const aud = audienceOf(req);
    const { tokens, user } = await this.auth.login(dto, aud, requestMeta(req));
    setAuthCookies(res, aud, tokens);
    return { user };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const aud = audienceOf(req);
    const raw = req.cookies?.[refreshCookie(aud)];
    if (!raw) throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول مجدداً');
    try {
      setAuthCookies(res, aud, await this.sessions.rotate(raw, aud, requestMeta(req)));
    } catch (e) {
      clearAuthCookies(res, aud);
      throw e;
    }
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const aud = audienceOf(req);
    const raw = req.cookies?.[refreshCookie(aud)];
    if (raw) await this.sessions.revokeByToken(raw);
    clearAuthCookies(res, aud);
  }

  @Post('password/reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    audienceOf(req);
    await this.auth.resetPassword(dto, requestMeta(req));
  }

  @Get('me')
  @Auth()
  @AllowWithoutMfa()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id, user.aud, user.mfa);
  }

  @Post('totp/setup')
  @HttpCode(200)
  @Auth('ADMIN', 'MODERATOR', 'FIELD_AGENT')
  @AllowWithoutMfa()
  totpSetup(@CurrentUser() user: AuthUser) {
    return this.auth.totpSetup(user.id);
  }

  @Post('totp/enable')
  @HttpCode(200)
  @Auth('ADMIN', 'MODERATOR', 'FIELD_AGENT')
  @AllowWithoutMfa()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async totpEnable(@CurrentUser() user: AuthUser, @Body() dto: TotpCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user: me } = await this.auth.totpEnable(user.id, dto.code, requestMeta(req));
    setAuthCookies(res, 'admin', tokens);
    return { user: me };
  }
}
