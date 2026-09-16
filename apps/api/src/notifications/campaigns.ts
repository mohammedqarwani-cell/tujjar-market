import { BadRequestException, Body, Controller, Get, Injectable, Logger, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CampaignAudience, NotificationCategory, Prisma } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Throttle } from '../common/throttle';
import { pageResult, paging } from '../common/pagination';
import { clientIp } from '../common/request';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

const AUDIENCES: CampaignAudience[] = ['BUYERS', 'MERCHANTS', 'MERCHANTS_UNVERIFIED', 'ALL'];
const CATEGORIES: NotificationCategory[] = ['PROMOTIONS', 'INVITES'];
const BATCH = 500;

class CreateCampaignDto {
  @IsIn(CATEGORIES, { message: 'اختر نوع الحملة' }) category!: 'PROMOTIONS' | 'INVITES';
  @IsIn(AUDIENCES, { message: 'اختر الجمهور' }) audience!: CampaignAudience;
  @IsString() @MinLength(3, { message: 'العنوان قصير جداً' }) @MaxLength(80) title!: string;
  @IsString() @MinLength(5, { message: 'النص قصير جداً' }) @MaxLength(240) body!: string;
  /** A path inside the recipients' own interface only; notifications never point to other sites */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^\/(?!\/)[^\s\\]*$/, { message: 'الرابط يجب أن يكون صفحة داخل المنصة ويبدأ بـ /' })
  url?: string;
}

function audienceWhere(audience: CampaignAudience): Prisma.UserWhereInput {
  const active = { status: 'ACTIVE' } as const;
  switch (audience) {
    case 'BUYERS':
      return { ...active, role: 'BUYER' };
    case 'MERCHANTS':
      return { ...active, role: 'MERCHANT' };
    case 'MERCHANTS_UNVERIFIED':
      return { ...active, role: 'MERCHANT', stores: { some: { verificationLevel: 'REGISTERED', status: 'ACTIVE' } } };
    default:
      return { ...active, role: { in: ['BUYER', 'MERCHANT'] } };
  }
}

@Injectable()
export class CampaignsService {
  private readonly log = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { createdBy: { select: { name: true } } },
      }),
      this.prisma.campaign.count(),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async estimate(audience: string) {
    if (!AUDIENCES.includes(audience as CampaignAudience)) throw new BadRequestException('اختر الجمهور');
    return { recipients: await this.prisma.user.count({ where: audienceWhere(audience as CampaignAudience) }) };
  }

  async create(actorId: string, dto: CreateCampaignDto, ip: string) {
    const where = audienceWhere(dto.audience);
    const recipients = await this.prisma.user.count({ where });
    if (!recipients) throw new BadRequestException('لا يوجد مستخدمون في هذا الجمهور');
    const campaign = await this.prisma.campaign.create({
      data: {
        category: dto.category,
        audience: dto.audience,
        title: dto.title.trim(),
        body: dto.body.trim(),
        url: dto.url || null,
        recipients,
        createdById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: campaign.id,
      meta: { audience: dto.audience, category: dto.category, recipients, title: campaign.title },
      ip,
    });
    void this.run(campaign.id, where);
    return campaign;
  }

  /** Delivers in batches in the background; respects every user's preferences and push limits. */
  private async run(id: string, where: Prisma.UserWhereInput) {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id } });
    let cursor: string | undefined;
    try {
      for (;;) {
        const users = await this.prisma.user.findMany({
          where,
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (!users.length) break;
        cursor = users[users.length - 1].id;
        const { delivered, pushed } = await this.notifications.deliver(
          users.map((u) => u.id),
          {
            category: campaign.category,
            type: 'campaign',
            title: campaign.title,
            body: campaign.body,
            url: campaign.url,
            groupKey: `campaign:${campaign.id}`,
            once: true,
            campaignId: campaign.id,
          },
        );
        await this.prisma.campaign.update({
          where: { id },
          data: { delivered: { increment: delivered }, pushed: { increment: pushed } },
        });
      }
      await this.prisma.campaign.update({ where: { id }, data: { status: 'SENT', finishedAt: new Date() } });
    } catch (e) {
      this.log.error(`Campaign ${id} failed`, (e as Error).stack);
      await this.prisma.campaign.update({ where: { id }, data: { status: 'FAILED', finishedAt: new Date() } }).catch(() => undefined);
    }
  }
}

/** Only full admins send to many users at once. */
@Controller('admin/campaigns')
@Auth('ADMIN')
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.campaigns.list(query);
  }

  @Get('estimate')
  estimate(@Query('audience') audience: string) {
    return this.campaigns.estimate(audience);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCampaignDto, @Req() req: Request) {
    return this.campaigns.create(actor.id, dto, clientIp(req));
  }
}
