import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { Auth } from './guards';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './current-user.decorator';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @RateLimit(5, 60 * 60)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit(10, 15 * 60)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
