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
} from '@nestjs/common';
import { Fulfillment, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Throttle } from '../common/throttle';
import { paging, pageResult } from '../common/pagination';
import { publicStoreWhere } from '../common/selects';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

const STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'DONE', 'CANCELLED'];
const FULFILLMENTS: Fulfillment[] = ['DELIVERY', 'PICKUP'];
const PAYMENTS: PaymentMethod[] = ['CASH_ON_DELIVERY', 'CASH_AT_SHOP', 'TRANSFER'];
/** The same product ordered again within this window is a double tap, not a second order */
const DEDUPE_MS = 2 * 60_000;

class CreateOrderDto {
  @IsString() @MaxLength(40) productId!: string;
  @Type(() => Number) @IsInt({ message: 'الكمية يجب أن تكون رقماً' }) @Min(1, { message: 'أقل كمية 1' }) @Max(9999) quantity!: number;
  @IsIn(FULFILLMENTS, { message: 'اختر التوصيل أو الاستلام من المحل' }) fulfillment!: Fulfillment;
  @IsIn(PAYMENTS, { message: 'اختر طريقة الدفع' }) payment!: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(40) governorateId?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'العنوان طويل' }) address?: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'الملاحظة طويلة' }) note?: string;
}

class MerchantUpdateDto {
  @IsIn(['CONFIRMED', 'DONE', 'CANCELLED'], { message: 'حالة غير معروفة' }) status!: 'CONFIRMED' | 'DONE' | 'CANCELLED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) deliveryFee?: number;
  @IsOptional() @IsString() @MaxLength(300) merchantNote?: string;
  @IsOptional() @IsString() @MaxLength(200) cancelReason?: string;
}

class CancelDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

const orderSelect = {
  id: true,
  ref: true,
  productTitle: true,
  quantity: true,
  unitPrice: true,
  currency: true,
  total: true,
  fulfillment: true,
  address: true,
  payment: true,
  note: true,
  status: true,
  deliveryFee: true,
  merchantNote: true,
  cancelReason: true,
  createdAt: true,
  confirmedAt: true,
  closedAt: true,
  governorate: { select: { name: true } },
  product: { select: { id: true, images: true } },
} satisfies Prisma.OrderSelect;

const buyerFields = { buyerName: true, buyerPhone: true } as const;
const storeFields = { store: { select: { slug: true, name: true, whatsapp: true, phone: true } } } as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** The buyer places an order: quantity, where it goes and how it is paid. The shop confirms it. */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const buyer = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, phone: true } });
    if (!buyer) throw new NotFoundException('الحساب غير موجود');

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'ACTIVE', store: publicStoreWhere },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        priceType: true,
        inStock: true,
        store: { select: { id: true, name: true, ownerId: true, hasDelivery: true, governorateId: true } },
      },
    });
    if (!product) throw new NotFoundException('المنتج غير متاح للطلب');
    if (!product.inStock) throw new BadRequestException('المنتج غير متوفر حالياً');

    const store = product.store;
    if (dto.fulfillment === 'DELIVERY' && !store.hasDelivery) throw new BadRequestException('هذا المتجر لا يوفّر توصيل، اختر الاستلام من المحل');
    if (dto.fulfillment === 'DELIVERY') {
      if (!dto.address?.trim()) throw new BadRequestException('اكتب عنوان التوصيل');
      if (dto.payment === 'CASH_AT_SHOP') throw new BadRequestException('طريقة الدفع لا تناسب التوصيل');
    } else if (dto.payment === 'CASH_ON_DELIVERY') {
      throw new BadRequestException('طريقة الدفع لا تناسب الاستلام من المحل');
    }

    let governorateId: string | null = null;
    if (dto.fulfillment === 'DELIVERY') {
      const gov = await this.prisma.governorate.findFirst({
        where: { id: dto.governorateId ?? '', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!gov) throw new BadRequestException('اختر المحافظة');
      governorateId = gov.id;
    }

    // Two taps on "أرسل الطلب" must not become two orders
    const recent = await this.prisma.order.findFirst({
      where: { buyerId: buyer.id, productId: product.id, status: 'NEW', createdAt: { gt: new Date(Date.now() - DEDUPE_MS) } },
      select: { id: true, ref: true },
    });
    if (recent) return recent;

    const unitPrice = product.priceType === 'FIXED' ? product.price : null;
    const order = await this.prisma.order.create({
      data: {
        storeId: store.id,
        productId: product.id,
        buyerId: buyer.id,
        productTitle: product.title,
        buyerName: buyer.name,
        buyerPhone: buyer.phone,
        quantity: dto.quantity,
        unitPrice,
        currency: product.currency,
        total: unitPrice === null ? null : unitPrice * dto.quantity,
        fulfillment: dto.fulfillment,
        governorateId,
        address: dto.fulfillment === 'DELIVERY' ? dto.address!.trim() : null,
        payment: dto.payment,
        note: dto.note?.trim() || null,
      },
      select: { id: true, ref: true },
    });

    // An order is also a contact, so the buyer may review the shop afterwards
    await this.prisma.storeContact.upsert({
      where: { storeId_buyerId: { storeId: store.id, buyerId: buyer.id } },
      create: { storeId: store.id, buyerId: buyer.id },
      update: { lastContactAt: new Date(), contacts: { increment: 1 } },
    });

    this.notifications.notify(store.ownerId, {
      category: 'ORDERS',
      type: 'order.new',
      title: `طلب جديد #${order.ref} 🛒`,
      body: `${buyer.name} طلب ${dto.quantity} × «${product.title}»`,
      url: '/dashboard/orders',
      groupKey: `order:${order.id}`,
      urgent: true,
    });

    return order;
  }

  /** The buyer's own orders, so they can follow what the shop answered. */
  async mine(userId: string, query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const where: Prisma.OrderWhereInput = { buyerId: userId };
    if (STATUSES.includes(query.status as OrderStatus)) where.status = query.status as OrderStatus;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, select: { ...orderSelect, ...storeFields }, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.order.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async cancelByBuyer(userId: string, id: string, dto: CancelDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, buyerId: userId },
      select: { id: true, status: true, ref: true, productTitle: true, store: { select: { ownerId: true } } },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status === 'DONE' || order.status === 'CANCELLED') throw new BadRequestException('لا يمكن إلغاء هذا الطلب');

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: dto.reason?.trim() || 'ألغاه الزبون', closedAt: new Date() },
      select: { ...orderSelect, ...storeFields },
    });
    this.notifications.notify(order.store.ownerId, {
      category: 'ORDERS',
      type: 'order.cancelled',
      title: `ألغى الزبون الطلب #${order.ref}`,
      body: `«${order.productTitle}»`,
      url: '/dashboard/orders',
      groupKey: `order:${order.id}`,
    });
    return updated;
  }

  async listForStore(userId: string, query: Record<string, string>) {
    const store = await this.storeOf(userId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const where: Prisma.OrderWhereInput = { storeId: store.id };
    if (STATUSES.includes(query.status as OrderStatus)) where.status = query.status as OrderStatus;

    const [items, total, counts] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: { ...orderSelect, ...buyerFields },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: { storeId: store.id }, _count: true, orderBy: undefined }),
    ]);
    return {
      ...pageResult(items, total, page, pageSize),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<OrderStatus, number>>,
    };
  }

  /** The shop answers: confirms with a delivery fee and a note, marks it delivered, or cancels. */
  async updateByMerchant(userId: string, id: string, dto: MerchantUpdateDto) {
    const store = await this.storeOf(userId);
    const order = await this.prisma.order.findFirst({
      where: { id, storeId: store.id },
      select: { id: true, ref: true, status: true, buyerId: true, productTitle: true, confirmedAt: true, fulfillment: true },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status === 'DONE' || order.status === 'CANCELLED') throw new BadRequestException('الطلب مغلق');
    if (dto.status === 'CONFIRMED' && dto.deliveryFee !== undefined && order.fulfillment === 'PICKUP') {
      throw new BadRequestException('لا توجد أجرة توصيل لطلب استلام من المحل');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        deliveryFee: dto.deliveryFee ?? undefined,
        merchantNote: dto.merchantNote?.trim() || undefined,
        cancelReason: dto.status === 'CANCELLED' ? dto.cancelReason?.trim() || 'ألغاه المتجر' : undefined,
        confirmedAt: dto.status === 'CONFIRMED' ? (order.confirmedAt ?? new Date()) : undefined,
        closedAt: dto.status === 'CONFIRMED' ? undefined : new Date(),
      },
      select: { ...orderSelect, ...buyerFields },
    });

    const texts: Record<typeof dto.status, { title: string; body: string }> = {
      CONFIRMED: { title: `أكّد المتجر طلبك #${order.ref} ✓`, body: `«${order.productTitle}» — التاجر رح يتواصل معك للتسليم` },
      DONE: { title: `تم تسليم طلبك #${order.ref}`, body: `«${order.productTitle}» — قيّم المتجر ليستفيد باقي الزبائن` },
      CANCELLED: { title: `أُلغي طلبك #${order.ref}`, body: updated.cancelReason ?? `«${order.productTitle}»` },
    };
    this.notifications.notify(order.buyerId, {
      category: 'ORDERS',
      type: `order.${dto.status.toLowerCase()}`,
      title: texts[dto.status].title,
      body: texts[dto.status].body,
      url: '/account/orders',
      groupKey: `order:${order.id}`,
      urgent: dto.status !== 'DONE',
    });
    return updated;
  }

  async pending(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) return { newOrders: 0 };
    return { newOrders: await this.prisma.order.count({ where: { storeId: store.id, status: 'NEW' } }) };
  }

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }
}

/** Orders carry the buyer's own name and number, so only signed-in buyers place them. */
@Controller('orders')
@Auth('BUYER')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 3600_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.orders.mine(user.id, query);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.cancelByBuyer(user.id, id, dto);
  }
}

/** A buyer's address and number stay with the shop they ordered from. */
@Controller('merchant/orders')
@Auth('MERCHANT')
export class MerchantOrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.orders.listForStore(user.id, query);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.orders.pending(user.id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MerchantUpdateDto) {
    return this.orders.updateByMerchant(user.id, id, dto);
  }
}

@Module({
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
