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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PostKind, Prisma } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Throttle } from '../common/throttle';
import { damascusDay, paging, pageResult } from '../common/pagination';
import { productCardSelect, publicStoreWhere } from '../common/selects';
import { env } from '../env';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

const KINDS: PostKind[] = ['POST', 'REEL', 'STORY'];
/** A status fades after a day, like the ones merchants already use on WhatsApp */
const STORY_HOURS = 24;
/** What one shop may publish in a day, so the feed stays readable */
const DAILY_LIMIT = 10;

class CreatePostDto {
  @IsIn(KINDS, { message: 'اختر نوع المنشور' }) kind!: PostKind;
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'النص أطول من 1000 حرف' })
  text?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'الحد الأقصى 6 صور' })
  @IsString({ each: true })
  images?: string[];
  @IsOptional() @IsString() @MaxLength(500) videoUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) productId?: string;
}

class UpdatePostDto {
  @IsIn(['ACTIVE', 'HIDDEN'], { message: 'حالة غير معروفة' }) status!:
    | 'ACTIVE'
    | 'HIDDEN';
}

const postSelect = {
  id: true,
  kind: true,
  text: true,
  images: true,
  videoUrl: true,
  views: true,
  createdAt: true,
  expiresAt: true,
  product: { select: productCardSelect },
  store: {
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      verificationLevel: true,
      governorate: { select: { name: true } },
    },
  },
} satisfies Prisma.StorePostSelect;

/** Only live posts from live shops, and a status only while it lasts */
function publicWhere(now: Date): Prisma.StorePostWhereInput {
  return {
    status: 'ACTIVE',
    store: publicStoreWhere,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** The public feed: what shops published, newest first, narrowed to the visitor's governorate. */
  async feed(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      30,
    );
    const where: Prisma.StorePostWhereInput = { ...publicWhere(new Date()) };
    if (KINDS.includes(query.kind as PostKind))
      where.kind = query.kind as PostKind;
    else where.kind = { in: ['POST', 'REEL'] };
    if (query.gov)
      where.store = {
        ...publicStoreWhere,
        governorate: { status: 'ACTIVE', slug: query.gov },
      };
    if (query.store) where.store = { ...publicStoreWhere, slug: query.store };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.storePost.findMany({
        where,
        select: postSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.storePost.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  /** Live statuses grouped by shop, for the circles at the top of the home page. */
  async stories(gov?: string) {
    const where: Prisma.StorePostWhereInput = {
      ...publicWhere(new Date()),
      kind: 'STORY',
    };
    if (gov)
      where.store = {
        ...publicStoreWhere,
        governorate: { status: 'ACTIVE', slug: gov },
      };
    const posts = await this.prisma.storePost.findMany({
      where,
      select: postSelect,
      orderBy: { createdAt: 'asc' },
      take: 120,
    });

    const byStore = new Map<
      string,
      { store: (typeof posts)[number]['store']; items: typeof posts }
    >();
    for (const post of posts) {
      const entry = byStore.get(post.store.slug) ?? {
        store: post.store,
        items: [],
      };
      entry.items.push(post);
      byStore.set(post.store.slug, entry);
    }
    return [...byStore.values()];
  }

  async view(id: string) {
    await this.prisma.storePost.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { views: { increment: 1 } },
    });
  }

  async click(id: string) {
    await this.prisma.storePost.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { clicks: { increment: 1 } },
    });
  }

  /* --------------------------------------------------------------- merchant */

  async listForStore(userId: string, query: Record<string, string>) {
    const store = await this.storeOf(userId);
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      50,
    );
    const where: Prisma.StorePostWhereInput = { storeId: store.id };
    if (KINDS.includes(query.kind as PostKind))
      where.kind = query.kind as PostKind;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.storePost.findMany({
        where,
        select: { ...postSelect, status: true, clicks: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.storePost.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async create(userId: string, dto: CreatePostDto) {
    const store = await this.storeOf(userId);
    const text = dto.text?.trim() || null;
    const images = (dto.images ?? []).map((url) => url.trim()).filter(Boolean);
    const videoUrl = dto.videoUrl?.trim() || null;

    // Pictures and videos must be the ones the merchant uploaded here
    for (const url of [...images, ...(videoUrl ? [videoUrl] : [])]) {
      if (!url.startsWith(`${env.minio.publicUrl}/`))
        throw new BadRequestException('ارفع الصور والفيديو من هذه الصفحة');
    }

    if (dto.kind === 'REEL' && !videoUrl)
      throw new BadRequestException('ارفع الفيديو أولاً');
    if (dto.kind !== 'REEL' && !images.length && !text)
      throw new BadRequestException('اكتب نصاً أو أضف صورة');
    if (dto.kind === 'STORY' && !images.length && !videoUrl)
      throw new BadRequestException('الحالة تحتاج صورة أو فيديو');

    let productId: string | null = null;
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, storeId: store.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!product) throw new BadRequestException('المنتج غير موجود في متجرك');
      productId = product.id;
    }

    const since = new Date(Date.now() - 24 * 3600_000);
    const today = await this.prisma.storePost.count({
      where: { storeId: store.id, createdAt: { gt: since } },
    });
    if (today >= DAILY_LIMIT)
      throw new BadRequestException(
        `الحد ${DAILY_LIMIT} منشورات في اليوم، جرّب بكرا`,
      );

    const post = await this.prisma.storePost.create({
      data: {
        storeId: store.id,
        kind: dto.kind,
        text,
        images,
        videoUrl,
        productId,
        expiresAt:
          dto.kind === 'STORY'
            ? new Date(Date.now() + STORY_HOURS * 3600_000)
            : null,
      },
      select: { ...postSelect, status: true, clicks: true },
    });

    // A status is fleeting, so only posts and reels reach the followers' notifications
    if (dto.kind !== 'STORY')
      this.announce(store.id, post.id, post.store.name, text ?? 'منشور جديد');
    return post;
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const store = await this.storeOf(userId);
    const post = await this.prisma.storePost.findFirst({
      where: { id, storeId: store.id },
      select: { id: true, status: true },
    });
    if (!post) throw new NotFoundException('المنشور غير موجود');
    if (post.status === 'UNDER_REVIEW')
      throw new BadRequestException('المنشور قيد المراجعة من الإدارة');
    return this.prisma.storePost.update({
      where: { id },
      data: { status: dto.status },
      select: { ...postSelect, status: true, clicks: true },
    });
  }

  async remove(userId: string, id: string) {
    const store = await this.storeOf(userId);
    const { count } = await this.prisma.storePost.deleteMany({
      where: { id, storeId: store.id },
    });
    if (!count) throw new NotFoundException('المنشور غير موجود');
    return { ok: true };
  }

  /** Followers hear about it, grouped so a busy shop sends one notification a day. */
  private announce(
    storeId: string,
    postId: string,
    storeName: string,
    preview: string,
  ) {
    void (async () => {
      const followers = await this.prisma.storeFollow.findMany({
        where: { storeId },
        select: { userId: true },
      });
      if (!followers.length) return;
      this.notifications.notify(
        followers.map((f) => f.userId),
        {
          category: 'FOLLOWING',
          type: 'post.new',
          title: `منشور جديد من ${storeName}`,
          body: preview.slice(0, 90),
          url: `/feed?post=${postId}`,
          groupKey: `store-post:${storeId}:${damascusDay().toISOString().slice(0, 10)}`,
          grouped: (count) => ({
            title: `جديد من ${storeName}`,
            body: `نشر ${storeName} ${count} منشورات اليوم`,
          }),
        },
      );
    })().catch(() => undefined);
  }

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }
}

@Controller()
export class PublicPostsController {
  constructor(private posts: PostsService) {}

  @Get('feed')
  feed(@Query() query: Record<string, string>) {
    return this.posts.feed(query);
  }

  @Get('stories')
  stories(@Query('gov') gov?: string) {
    return this.posts.stories(gov);
  }

  @Post('feed/:id/view')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async view(@Param('id') id: string) {
    if (/^[a-z0-9]{10,40}$/.test(id)) await this.posts.view(id);
  }

  @Post('feed/:id/click')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async click(@Param('id') id: string) {
    if (/^[a-z0-9]{10,40}$/.test(id)) await this.posts.click(id);
  }
}

@Controller('merchant/posts')
@Auth('MERCHANT')
export class MerchantPostsController {
  constructor(private posts: PostsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.posts.listForStore(user.id, query);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 3600_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.remove(user.id, id);
  }
}

@Module({
  controllers: [PublicPostsController, MerchantPostsController],
  providers: [PostsService],
})
export class PostsModule {}
