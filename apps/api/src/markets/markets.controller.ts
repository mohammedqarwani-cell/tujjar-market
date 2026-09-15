import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '../common/throttle';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import {
  CreateCategoryDto,
  CreateMarketDto,
  GeofenceDto,
  GovernorateStatusDto,
  InterestContactedDto,
  InterestDto,
  UpdateCategoryDto,
  UpdateMarketDto,
} from './markets.dto';
import { MarketsService } from './markets.service';

/** Governorates, markets, categories and merchant interest. Reading is open to moderators; changes to admins. */
@Controller('admin')
@Auth('ADMIN', 'MODERATOR')
export class AdminPlacesController {
  constructor(private markets: MarketsService) {}

  @Get('governorates')
  governorates() {
    return this.markets.governorates();
  }

  @Patch('governorates/:id/status')
  @Auth('ADMIN')
  setGovernorateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: GovernorateStatusDto, @Req() req: Request) {
    return this.markets.setGovernorateStatus(actor.id, id, dto.status, clientIp(req));
  }

  @Get('markets')
  list(@Query() query: Record<string, string>) {
    return this.markets.markets(query);
  }

  @Post('markets')
  @Auth('ADMIN')
  createMarket(@CurrentUser() actor: AuthUser, @Body() dto: CreateMarketDto, @Req() req: Request) {
    return this.markets.createMarket(actor.id, dto, clientIp(req));
  }

  @Patch('markets/:id')
  @Auth('ADMIN')
  updateMarket(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateMarketDto, @Req() req: Request) {
    return this.markets.updateMarket(actor.id, id, dto, clientIp(req));
  }

  @Delete('markets/:id')
  @Auth('ADMIN')
  @HttpCode(204)
  async deleteMarket(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Req() req: Request) {
    await this.markets.deleteMarket(actor.id, id, clientIp(req));
  }

  @Patch('markets/:id/geofence')
  @Auth('ADMIN')
  setGeofence(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: GeofenceDto, @Req() req: Request) {
    return this.markets.setGeofence(actor.id, id, dto, clientIp(req));
  }

  @Delete('markets/:id/geofence')
  @Auth('ADMIN')
  removeGeofence(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.markets.removeGeofence(actor.id, id, clientIp(req));
  }

  @Get('markets/:id/geofence-suggestion')
  suggestGeofence(@Param('id') id: string) {
    return this.markets.suggestGeofence(id);
  }

  @Get('categories')
  categories() {
    return this.markets.categories();
  }

  @Post('categories')
  @Auth('ADMIN')
  createCategory(@CurrentUser() actor: AuthUser, @Body() dto: CreateCategoryDto, @Req() req: Request) {
    return this.markets.createCategory(actor.id, dto, clientIp(req));
  }

  @Patch('categories/:id')
  @Auth('ADMIN')
  updateCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto, @Req() req: Request) {
    return this.markets.updateCategory(actor.id, id, dto, clientIp(req));
  }

  @Delete('categories/:id')
  @Auth('ADMIN')
  @HttpCode(204)
  async deleteCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Req() req: Request) {
    await this.markets.deleteCategory(actor.id, id, clientIp(req));
  }

  @Get('interests')
  interests(@Query() query: Record<string, string>) {
    return this.markets.interests(query);
  }

  @Patch('interests/:id')
  setInterestContacted(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: InterestContactedDto, @Req() req: Request) {
    return this.markets.setInterestContacted(actor.id, id, dto.contacted, clientIp(req));
  }
}

@Controller('interest')
export class InterestController {
  constructor(private markets: MarketsService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  async create(@Body() dto: InterestDto, @Req() req: Request) {
    await this.markets.createInterest(dto, clientIp(req));
  }
}
