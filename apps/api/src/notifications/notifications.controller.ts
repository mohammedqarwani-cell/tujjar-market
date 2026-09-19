import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Throttle } from '../common/throttle';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

class MarkReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids?: string[];
}

class PreferencesDto {
  /** { FOLLOWING: { inApp: true, push: false }, ... } */
  @IsObject() prefs!: Record<string, { inApp?: boolean; push?: boolean }>;
}

class PushKeysDto {
  @IsString() @MaxLength(200) p256dh!: string;
  @IsString() @MaxLength(100) auth!: string;
}

class SubscribeDto {
  @IsString() @MaxLength(1000) endpoint!: string;
  @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() @MaxLength(1000) endpoint!: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private push: PushService,
  ) {}

  /** Public key browsers need to subscribe to Web Push. */
  @Get('push/key')
  async pushKey() {
    return { publicKey: await this.push.getPublicKey() };
  }

  @Get()
  @Auth()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @Auth()
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read')
  @Auth()
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.id, dto.ids);
  }

  @Get('preferences')
  @Auth()
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  @Auth()
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: PreferencesDto,
  ) {
    return this.notifications.updatePreferences(user.id, dto.prefs);
  }

  @Post('push/subscribe')
  @Auth()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3600_000 } })
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Req() req: Request,
  ) {
    return this.notifications.subscribe(
      user.id,
      user.aud,
      dto,
      String(req.headers['user-agent'] ?? '').slice(0, 200),
    );
  }

  @Post('push/unsubscribe')
  @Auth()
  @HttpCode(200)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(user.id, dto.endpoint);
  }

  @Post('push/test')
  @Auth()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  test(@CurrentUser() user: AuthUser) {
    return this.notifications.sendTest(user.id, user.aud);
  }
}
