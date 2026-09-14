import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { StatsService } from './stats.service';

class TrackViewDto {
  @IsOptional() @IsString() storeSlug?: string;
  @IsOptional() @IsString() productId?: string;
}

class TrackContactDto {
  @IsString() storeSlug!: string;
  @IsOptional() @IsString() productId?: string;
  @IsIn(['WHATSAPP', 'CALL']) channel!: 'WHATSAPP' | 'CALL';
}

const clientIp = (req: any): string =>
  (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip ?? 'unknown').trim();

@Controller('track')
@UseGuards(RateLimitGuard)
export class TrackController {
  constructor(private stats: StatsService) {}

  @Post('view')
  @HttpCode(204)
  @RateLimit(120, 60)
  async view(@Body() dto: TrackViewDto, @Req() req: any) {
    await this.stats.trackView(clientIp(req), dto);
  }

  @Post('contact')
  @HttpCode(204)
  @RateLimit(30, 60)
  async contact(@Body() dto: TrackContactDto, @Req() req: any) {
    await this.stats.trackContact(clientIp(req), dto);
  }
}

@Controller('merchant/stats')
@Auth('MERCHANT', 'ADMIN')
export class MerchantStatsController {
  constructor(private stats: StatsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.stats.merchantOverview(user.id, Number(days) || 30);
  }
}
