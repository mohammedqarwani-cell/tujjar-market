import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '../common/throttle';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
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

@Controller('track')
export class TrackController {
  constructor(private stats: StatsService) {}

  @Post('view')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async view(@Body() dto: TrackViewDto, @Req() req: Request) {
    await this.stats.trackView(clientIp(req), dto);
  }

  @Post('contact')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async contact(@Body() dto: TrackContactDto, @Req() req: Request) {
    await this.stats.trackContact(clientIp(req), dto);
  }
}

@Controller('merchant/stats')
@Auth('MERCHANT')
export class MerchantStatsController {
  constructor(private stats: StatsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.stats.merchantOverview(user.id, Number(days) || 30);
  }
}
