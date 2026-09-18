import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Throttle } from '../common/throttle';
import { paging, pageResult } from '../common/pagination';
import { publicStoreWhere } from '../common/selects';
import { normalizeSyrianMobile } from '../common/text/phone';
import { Auth, OptionalJwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'DONE', 'CANCELLED'];
/** A second request for the same thing from the same number within this window is the same request */
const DEDUPE_MS = 10 * 60_000;

class CreateLeadDto {
  @IsString() @MaxLength(80) storeSlug!: string;
  @IsOptional() @IsString() @MaxLength(40) productId?: string;
  @IsString() @MinLength(2, { message: 'اكتب اسمك' }) @MaxLength(60, { message: 'الاسم طويل' }) name!: string;
  @IsString() @MaxLength(20) phone!: string;
  @IsOptional() @Type(() => Number) @IsInt({ message: 'الكمية يجب أن تكون رقماً' }) @Min(1) @Max(9999) quantity?: number;
  @IsOptional() @IsString() @MaxLength(500, { message: 'الملاحظة طويلة' }) note?: string;
}

class UpdateLeadDto {
  @IsIn(STATUSES, { message: 'حالة غير معروفة' }) status!: LeadStatus;
}

const leadSelect = {
  id: true,
  name: true,
  phone: true,
  quantity: true,
  note: true,
  status: true,
  createdAt: true,
  handledAt: true,
  product: { select: { id: true, title: true, price: true, currency: true, priceType: true, images: true } },
} satisfies Prisma.LeadSelect;

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** A buyer asks a shop for a product; the shop gets it in its dashboard and as a notification. */
  async create(dto: CreateLeadDto, user: AuthUser | null) {
    const phone = normalizeSyrianMobile(dto.phone);
    if (!phone) throw new BadRequestException('اكتب رقم موبايل سوري صحيح، مثال: 0999123456');

    const store = await this.prisma.store.findFirst({
      where: { slug: dto.storeSlug, ...publicStoreWhere },
      select: { id: true, name: true, ownerId: true },
    });
    if (!store) throw new NotFoundException('المتجر غير متاح');

    let product: { id: string; title: string } | null = null;
    if (dto.productId) {
      product = await this.prisma.product.findFirst({
        where: { id: dto.productId, storeId: store.id, status: 'ACTIVE' },
        select: { id: true, title: true },
      });
      if (!product) throw new NotFoundException('المنتج غير متاح');
    }

    // A double tap, or an impatient second send, must not reach the merchant twice
    const recent = await this.prisma.lead.findFirst({
      where: {
        storeId: store.id,
        phone,
        productId: product?.id ?? null,
        createdAt: { gt: new Date(Date.now() - DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (recent) return { id: recent.id, ok: true };

    const lead = await this.prisma.lead.create({
      data: {
        storeId: store.id,
        productId: product?.id ?? null,
        buyerId: user?.role === 'BUYER' ? user.id : null,
        name: dto.name.trim(),
        phone,
        quantity: dto.quantity ?? null,
        note: dto.note?.trim() || null,
      },
      select: { id: true },
    });

    // Contacting through a request also lets a signed-in buyer review the shop later
    if (user?.role === 'BUYER') {
      await this.prisma.storeContact.upsert({
        where: { storeId_buyerId: { storeId: store.id, buyerId: user.id } },
        create: { storeId: store.id, buyerId: user.id },
        update: { lastContactAt: new Date(), contacts: { increment: 1 } },
      });
    }

    this.notifications.notify(store.ownerId, {
      category: 'ORDERS',
      type: 'lead.new',
      title: 'طلب جديد من زبون 🛎',
      body: product ? `${dto.name.trim()} يسأل عن «${product.title}»` : `${dto.name.trim()} يسأل عن متجرك`,
      url: '/dashboard/orders',
      groupKey: `lead:${lead.id}`,
      urgent: true,
    });

    return { id: lead.id, ok: true };
  }

  async list(userId: string, query: Record<string, string>) {
    const store = await this.storeOf(userId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const where: Prisma.LeadWhereInput = { storeId: store.id };
    if (STATUSES.includes(query.status as LeadStatus)) where.status = query.status as LeadStatus;
    else if (query.status === 'OPEN') where.status = { in: ['NEW', 'CONTACTED'] };

    const [items, total, counts] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, select: leadSelect, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({ by: ['status'], where: { storeId: store.id }, _count: true, orderBy: undefined }),
    ]);
    return {
      ...pageResult(items, total, page, pageSize),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<LeadStatus, number>>,
    };
  }

  async update(userId: string, id: string, dto: UpdateLeadDto) {
    const store = await this.storeOf(userId);
    const lead = await this.prisma.lead.findFirst({ where: { id, storeId: store.id }, select: { id: true, handledAt: true } });
    if (!lead) throw new NotFoundException('الطلب غير موجود');
    return this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status,
        handledAt: dto.status === 'NEW' ? null : (lead.handledAt ?? new Date()),
      },
      select: leadSelect,
    });
  }

  /** Requests waiting for an answer, for the dashboard overview and the menu badge. */
  async pending(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) return { newLeads: 0 };
    return { newLeads: await this.prisma.lead.count({ where: { storeId: store.id, status: 'NEW' } }) };
  }

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }
}

@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post()
  @Throttle({ default: { limit: 8, ttl: 3600_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser | null) {
    return this.leads.create(dto, user);
  }
}

/** Buyer names and numbers stay with the shop they wrote to: only its owner can read them. */
@Controller('merchant/leads')
@Auth('MERCHANT')
export class MerchantLeadsController {
  constructor(private leads: LeadsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.leads.list(user.id, query);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.leads.pending(user.id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(user.id, id, dto);
  }
}

@Module({
  controllers: [LeadsController, MerchantLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
