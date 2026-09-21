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
import {
  Fulfillment,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
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
const PAYMENTS: PaymentMethod[] = [
  'CASH_ON_DELIVERY',
  'CASH_AT_SHOP',
  'TRANSFER',
];
/** The same product ordered again within this window is a double tap, not a second order */
const DEDUPE_MS = 2 * 60_000;

class OrderLineDto {
  @IsString() @MaxLength(40) productId!: string;
  @Type(() => Number)
  @IsInt({ message: 'الكمية يجب أن تكون رقماً' })
  @Min(1, { message: 'أقل كمية 1' })
  @Max(9999)
  quantity!: number;
}

class CreateOrderDto {
  @IsArray({ message: 'أضف منتجاً واحداً على الأقل' })
  @ArrayMinSize(1, { message: 'أضف منتجاً واحداً على الأقل' })
  @ArrayMaxSize(40, { message: 'الحد الأقصى 40 صنفاً في الطلب' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
  @IsIn(FULFILLMENTS, { message: 'اختر التوصيل أو الاستلام من المحل' })
  fulfillment!: Fulfillment;
  @IsIn(PAYMENTS, { message: 'اختر طريقة الدفع' }) payment!: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(40) governorateId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'العنوان طويل' })
  address?: string;
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'الملاحظة طويلة' })
  note?: string;
}

class MerchantUpdateDto {
  @IsIn(['CONFIRMED', 'DONE', 'CANCELLED'], { message: 'حالة غير معروفة' })
  status!: 'CONFIRMED' | 'DONE' | 'CANCELLED';
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  deliveryFee?: number;
  @IsOptional() @IsString() @MaxLength(300) merchantNote?: string;
  @IsOptional() @IsString() @MaxLength(200) cancelReason?: string;
}

class CancelDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

const orderSelect = {
  id: true,
  ref: true,
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
  items: {
    select: {
      id: true,
      title: true,
      image: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      product: { select: { id: true } },
    },
  },
} satisfies Prisma.OrderSelect;

const buyerFields = { buyerName: true, buyerPhone: true } as const;

/**
 * Totals are stored as BigInt (they can pass Int32) but JSON can't carry a BigInt, so every order
 * that leaves this service goes through here. Values stay far below Number.MAX_SAFE_INTEGER
 * (at most 2e9 × 9999 × 40 lines ≈ 8e14).
 */
function toOrderView<
  T extends { total: bigint | null; items: { lineTotal: bigint | null }[] },
>(order: T) {
  return {
    ...order,
    total: order.total === null ? null : Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
    })),
  };
}
const storeFields = {
  store: { select: { slug: true, name: true, whatsapp: true, phone: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** The buyer sends one basket from one shop: its lines, where it goes and how it is paid. */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const buyer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, phone: true },
    });
    if (!buyer) throw new NotFoundException('الحساب غير موجود');

    const wanted = new Map<string, number>();
    for (const line of dto.items)
      wanted.set(
        line.productId,
        (wanted.get(line.productId) ?? 0) + line.quantity,
      );

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: [...wanted.keys()] },
        status: 'ACTIVE',
        store: publicStoreWhere,
      },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        priceType: true,
        inStock: true,
        images: true,
        store: {
          select: { id: true, name: true, ownerId: true, hasDelivery: true },
        },
      },
    });
    if (products.length !== wanted.size)
      throw new NotFoundException('أحد المنتجات لم يعد متاحاً للطلب');
    const unavailable = products.find((p) => !p.inStock);
    if (unavailable)
      throw new BadRequestException(`«${unavailable.title}» غير متوفر حالياً`);

    // One order belongs to one shop: the basket is per shop on the buyer's side too
    const store = products[0].store;
    if (products.some((p) => p.store.id !== store.id))
      throw new BadRequestException('الطلب الواحد يكون من متجر واحد');
    const currency = products[0].currency;
    if (products.some((p) => p.currency !== currency))
      throw new BadRequestException(
        'لا يمكن جمع منتجات بعملات مختلفة في طلب واحد',
      );

    if (dto.fulfillment === 'DELIVERY' && !store.hasDelivery)
      throw new BadRequestException(
        'هذا المتجر لا يوفّر توصيل، اختر الاستلام من المحل',
      );
    if (dto.fulfillment === 'DELIVERY') {
      if (!dto.address?.trim())
        throw new BadRequestException('اكتب عنوان التوصيل');
      if (dto.payment === 'CASH_AT_SHOP')
        throw new BadRequestException('طريقة الدفع لا تناسب التوصيل');
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

    const lines = products.map((p) => {
      const quantity = wanted.get(p.id)!;
      const unitPrice = p.priceType === 'FIXED' ? p.price : null;
      return {
        productId: p.id,
        title: p.title,
        image: p.images[0] ?? null,
        unitPrice,
        quantity,
        lineTotal: unitPrice === null ? null : unitPrice * quantity,
      };
    });
    // A basket where one line is priced on request has no total until the shop answers
    const total = lines.some((l) => l.lineTotal === null)
      ? null
      : lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);

    // Two taps on "أرسل الطلب" must not become two orders
    const recent = await this.prisma.order.findFirst({
      where: {
        buyerId: buyer.id,
        storeId: store.id,
        status: 'NEW',
        createdAt: { gt: new Date(Date.now() - DEDUPE_MS) },
        items: { every: { productId: { in: [...wanted.keys()] } } },
      },
      select: { id: true, ref: true, _count: { select: { items: true } } },
    });
    if (recent && recent._count.items === lines.length)
      return { id: recent.id, ref: recent.ref };

    const order = await this.prisma.order.create({
      data: {
        storeId: store.id,
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerPhone: buyer.phone,
        currency,
        total: total === null ? null : BigInt(total),
        fulfillment: dto.fulfillment,
        governorateId,
        address: dto.fulfillment === 'DELIVERY' ? dto.address!.trim() : null,
        payment: dto.payment,
        note: dto.note?.trim() || null,
        items: {
          create: lines.map((line) => ({
            ...line,
            lineTotal: line.lineTotal === null ? null : BigInt(line.lineTotal),
          })),
        },
      },
      select: { id: true, ref: true },
    });

    // An order is also a contact, so the buyer may review the shop afterwards
    await this.prisma.storeContact.upsert({
      where: { storeId_buyerId: { storeId: store.id, buyerId: buyer.id } },
      create: { storeId: store.id, buyerId: buyer.id },
      update: { lastContactAt: new Date(), contacts: { increment: 1 } },
    });

    const first = lines[0];
    this.notifications.notify(store.ownerId, {
      category: 'ORDERS',
      type: 'order.new',
      title: `طلب جديد #${order.ref} 🛒`,
      body:
        lines.length === 1
          ? `${buyer.name} طلب ${first.quantity} × «${first.title}»`
          : `${buyer.name} طلب ${lines.length} أصناف، منها «${first.title}»`,
      url: '/dashboard/orders',
      groupKey: `order:${order.id}`,
      urgent: true,
    });

    return order;
  }

  /** The buyer's own orders, so they can follow what the shop answered. */
  async mine(userId: string, query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      50,
    );
    const where: Prisma.OrderWhereInput = { buyerId: userId };
    if (STATUSES.includes(query.status as OrderStatus))
      where.status = query.status as OrderStatus;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: { ...orderSelect, ...storeFields },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return pageResult(items.map(toOrderView), total, page, pageSize);
  }

  async cancelByBuyer(userId: string, id: string, dto: CancelDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, buyerId: userId },
      select: {
        id: true,
        status: true,
        ref: true,
        store: { select: { ownerId: true } },
      },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status === 'DONE' || order.status === 'CANCELLED')
      throw new BadRequestException('لا يمكن إلغاء هذا الطلب');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason?.trim() || 'ألغاه الزبون',
        closedAt: new Date(),
      },
      select: { ...orderSelect, ...storeFields },
    });
    this.notifications.notify(order.store.ownerId, {
      category: 'ORDERS',
      type: 'order.cancelled',
      title: `ألغى الزبون الطلب #${order.ref}`,
      body: `تفاصيل الطلب في لوحتك`,
      url: '/dashboard/orders',
      groupKey: `order:${order.id}`,
    });
    return toOrderView(updated);
  }

  async listForStore(userId: string, query: Record<string, string>) {
    const store = await this.storeOf(userId);
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      50,
    );
    const where: Prisma.OrderWhereInput = { storeId: store.id };
    if (STATUSES.includes(query.status as OrderStatus))
      where.status = query.status as OrderStatus;

    const [items, total, counts] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: { ...orderSelect, ...buyerFields },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId: store.id },
        _count: true,
        orderBy: undefined,
      }),
    ]);
    return {
      ...pageResult(items.map(toOrderView), total, page, pageSize),
      counts: Object.fromEntries(
        counts.map((c) => [c.status, c._count]),
      ) as Partial<Record<OrderStatus, number>>,
    };
  }

  /** The shop answers: confirms with a delivery fee and a note, marks it delivered, or cancels. */
  async updateByMerchant(userId: string, id: string, dto: MerchantUpdateDto) {
    const store = await this.storeOf(userId);
    const order = await this.prisma.order.findFirst({
      where: { id, storeId: store.id },
      select: {
        id: true,
        ref: true,
        status: true,
        buyerId: true,
        confirmedAt: true,
        fulfillment: true,
        items: { select: { title: true }, take: 1 },
      },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status === 'DONE' || order.status === 'CANCELLED')
      throw new BadRequestException('الطلب مغلق');
    if (
      dto.status === 'CONFIRMED' &&
      dto.deliveryFee !== undefined &&
      order.fulfillment === 'PICKUP'
    ) {
      throw new BadRequestException('لا توجد أجرة توصيل لطلب استلام من المحل');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        deliveryFee: dto.deliveryFee ?? undefined,
        merchantNote: dto.merchantNote?.trim() || undefined,
        cancelReason:
          dto.status === 'CANCELLED'
            ? dto.cancelReason?.trim() || 'ألغاه المتجر'
            : undefined,
        confirmedAt:
          dto.status === 'CONFIRMED'
            ? (order.confirmedAt ?? new Date())
            : undefined,
        closedAt: dto.status === 'CONFIRMED' ? undefined : new Date(),
      },
      select: { ...orderSelect, ...buyerFields },
    });

    const what = order.items[0]
      ? `«${order.items[0].title}»`
      : `طلبك #${order.ref}`;
    const texts: Record<typeof dto.status, { title: string; body: string }> = {
      CONFIRMED: {
        title: `أكّد المتجر طلبك #${order.ref} ✓`,
        body: `${what} — التاجر رح يتواصل معك للتسليم`,
      },
      DONE: {
        title: `تم تسليم طلبك #${order.ref}`,
        body: `${what} — قيّم المتجر ليستفيد باقي الزبائن`,
      },
      CANCELLED: {
        title: `أُلغي طلبك #${order.ref}`,
        body: updated.cancelReason ?? what,
      },
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
    return toOrderView(updated);
  }

  async pending(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!store) return { newOrders: 0 };
    return {
      newOrders: await this.prisma.order.count({
        where: { storeId: store.id, status: 'NEW' },
      }),
    };
  }

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
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
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
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
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MerchantUpdateDto,
  ) {
    return this.orders.updateByMerchant(user.id, id, dto);
  }
}

@Module({
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
