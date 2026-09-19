import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '../common/throttle';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import {
  FlagReviewDto,
  MerchantReplyDto,
  ModerateReviewDto,
  ReviewInputDto,
} from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller('stores/:slug/reviews')
export class StoreReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get()
  list(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    return this.reviews.list(slug, query);
  }

  /** Whether the signed-in buyer may review this store, and their current review if any. */
  @Get('mine')
  @Auth('BUYER')
  mine(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.reviews.mine(user.id, slug);
  }

  @Post()
  @Auth('BUYER')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: ReviewInputDto,
    @Req() req: Request,
  ) {
    return this.reviews.submit(user.id, slug, dto, clientIp(req));
  }

  @Delete('mine')
  @Auth('BUYER')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Req() req: Request,
  ) {
    await this.reviews.removeMine(user.id, slug, clientIp(req));
  }
}

@Controller('merchant/reviews')
@Auth('MERCHANT')
export class MerchantReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reviews.merchantList(user.id, query);
  }

  @Patch(':id/reply')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MerchantReplyDto,
    @Req() req: Request,
  ) {
    return this.reviews.reply(user.id, id, dto.reply, clientIp(req));
  }

  @Post(':id/flag')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3600_000 } })
  flag(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FlagReviewDto,
    @Req() req: Request,
  ) {
    return this.reviews.flag(user.id, id, dto.reason, clientIp(req));
  }
}

@Controller('admin/reviews')
@Auth('ADMIN', 'MODERATOR')
export class AdminReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.reviews.adminList(query);
  }

  @Patch(':id')
  moderate(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @Req() req: Request,
  ) {
    return this.reviews.moderate(actor.id, id, dto, clientIp(req));
  }
}
