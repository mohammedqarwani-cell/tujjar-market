import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Auth, OptionalJwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { Throttle } from '../common/throttle';
import { productCardSelect, publicProductWhere, publicStoreWhere, storeCardSelect } from '../common/selects';

const MAX_FAVORITES = 200;
const MAX_FOLLOWS = 500;

class SyncFavoritesDto {
  @IsArray() @ArrayMaxSize(MAX_FAVORITES) @IsString({ each: true }) ids!: string[];
}

@Injectable()
export class EngagementService {
  constructor(private prisma: PrismaService) {}

  private async publicStoreId(slug: string) {
    const store = await this.prisma.store.findFirst({ where: { slug, ...publicStoreWhere }, select: { id: true } });
    if (!store) throw new NotFoundException('المتجر غير موجود');
    return store.id;
  }

  // ---------- follows ----------

  async followState(slug: string, userId?: string) {
    const storeId = await this.publicStoreId(slug);
    const [followers, mine] = await Promise.all([
      this.prisma.storeFollow.count({ where: { storeId } }),
      userId ? this.prisma.storeFollow.findUnique({ where: { userId_storeId: { userId, storeId } }, select: { userId: true } }) : null,
    ]);
    return { following: !!mine, followers };
  }

  async follow(userId: string, slug: string) {
    const storeId = await this.publicStoreId(slug);
    const count = await this.prisma.storeFollow.count({ where: { userId } });
    if (count >= MAX_FOLLOWS) throw new BadRequestException('وصلت للحد الأقصى من المتاجر المتابَعة');
    await this.prisma.storeFollow.upsert({
      where: { userId_storeId: { userId, storeId } },
      create: { userId, storeId },
      update: {},
    });
    return this.followState(slug, userId);
  }

  async unfollow(userId: string, slug: string) {
    const storeId = await this.publicStoreId(slug);
    await this.prisma.storeFollow.deleteMany({ where: { userId, storeId } });
    return this.followState(slug, userId);
  }

  async following(userId: string) {
    const follows = await this.prisma.storeFollow.findMany({
      where: { userId, store: publicStoreWhere },
      orderBy: { createdAt: 'desc' },
      select: { store: { select: storeCardSelect } },
    });
    return follows.map((f) => f.store);
  }

  // ---------- favorites ----------

  async favorites(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, product: publicProductWhere },
      orderBy: { createdAt: 'desc' },
      select: { product: { select: productCardSelect } },
    });
    return rows.map((r) => r.product);
  }

  async addFavorite(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, ...publicProductWhere }, select: { id: true } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    const count = await this.prisma.favorite.count({ where: { userId } });
    const exists = await this.prisma.favorite.findUnique({ where: { userId_productId: { userId, productId } }, select: { userId: true } });
    if (!exists && count >= MAX_FAVORITES) throw new BadRequestException('وصلت للحد الأقصى من المفضلة');
    await this.prisma.favorite.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} });
    return { favorite: true };
  }

  async removeFavorite(userId: string, productId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
    return { favorite: false };
  }

  /** Merges favorites saved on this device before signing in, then returns the account's full list. */
  async syncFavorites(userId: string, ids: string[]) {
    const existing = await this.prisma.favorite.count({ where: { userId } });
    const room = Math.max(0, MAX_FAVORITES - existing);
    if (room && ids.length) {
      const valid = await this.prisma.product.findMany({
        where: { id: { in: [...new Set(ids)] }, ...publicProductWhere },
        select: { id: true },
        take: room,
      });
      if (valid.length) {
        await this.prisma.favorite.createMany({ data: valid.map((p) => ({ userId, productId: p.id })), skipDuplicates: true });
      }
    }
    return this.favorites(userId);
  }
}

@Controller()
export class EngagementController {
  constructor(private engagement: EngagementService) {}

  @Get('stores/:slug/follow')
  @UseGuards(OptionalJwtAuthGuard)
  followState(@CurrentUser() user: AuthUser | null, @Param('slug') slug: string) {
    return this.engagement.followState(slug, user?.role === 'BUYER' ? user.id : undefined);
  }

  @Post('stores/:slug/follow')
  @Auth('BUYER')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 3600_000 } })
  follow(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.engagement.follow(user.id, slug);
  }

  @Delete('stores/:slug/follow')
  @Auth('BUYER')
  unfollow(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.engagement.unfollow(user.id, slug);
  }

  @Get('me/following')
  @Auth('BUYER')
  following(@CurrentUser() user: AuthUser) {
    return this.engagement.following(user.id);
  }

  @Get('me/favorites')
  @Auth('BUYER')
  favorites(@CurrentUser() user: AuthUser) {
    return this.engagement.favorites(user.id);
  }

  @Put('me/favorites/:productId')
  @Auth('BUYER')
  addFavorite(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.engagement.addFavorite(user.id, productId);
  }

  @Delete('me/favorites/:productId')
  @Auth('BUYER')
  removeFavorite(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.engagement.removeFavorite(user.id, productId);
  }

  @Post('me/favorites/sync')
  @Auth('BUYER')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 3600_000 } })
  sync(@CurrentUser() user: AuthUser, @Body() dto: SyncFavoritesDto) {
    return this.engagement.syncFavorites(user.id, dto.ids);
  }
}

@Module({
  controllers: [EngagementController],
  providers: [EngagementService],
})
export class EngagementModule {}
