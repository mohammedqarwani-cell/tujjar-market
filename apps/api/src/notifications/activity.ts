import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import type { Currency, PriceType, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { damascusDay } from '../common/pagination';
import { publicStoreWhere } from '../common/selects';
import { NotificationsService } from './notifications.service';

export type ProductSnapshot = {
  price: number | null;
  oldPrice: number | null;
  currency: Currency;
  priceType: PriceType;
  inStock: boolean;
  status: ProductStatus;
};

const DAY_MS = 86_400_000;
const REVIEW_INVITE_AFTER_MS = DAY_MS;
const REVIEW_INVITE_UNTIL_MS = 7 * DAY_MS;
const EXPIRY_REMINDER_DAYS = 30;
const JOB_EVERY_MS = 3600_000;

const money = (value: number, currency: Currency) =>
  `${value.toLocaleString('en-US')} ${currency === 'USD' ? '$' : 'ل.س'}`;
const trimTitle = (title: string) =>
  title.length > 60 ? `${title.slice(0, 57)}…` : title;

/**
 * Turns catalogue activity into notifications for people who asked for it:
 * followers of a store and buyers who saved a product. Also runs the hourly reminders.
 */
@Injectable()
export class ActivityNotifier implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(ActivityNotifier.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const run = () => void this.runReminders();
    this.timers.push(setTimeout(run, 60_000), setInterval(run, JOB_EVERY_MS));
    this.timers.forEach((t) => t.unref());
  }

  onApplicationShutdown() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  private async publicProduct(productId: string) {
    return this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE', store: publicStoreWhere },
      select: {
        id: true,
        title: true,
        price: true,
        oldPrice: true,
        currency: true,
        storeId: true,
        store: { select: { name: true, slug: true } },
      },
    });
  }

  /** A new listing reaches the store's followers, grouped per store per day. */
  productCreated(productId: string) {
    void (async () => {
      const product = await this.publicProduct(productId);
      if (!product) return;
      const followers = await this.prisma.storeFollow.findMany({
        where: { storeId: product.storeId },
        select: { userId: true },
      });
      const store = product.store.name;
      this.notifications.notify(
        followers.map((f) => f.userId),
        {
          category: 'FOLLOWING',
          type: 'product.new',
          title: `جديد من ${store}`,
          body: trimTitle(product.title),
          url: `/products/${product.id}`,
          groupKey: `store-new:${product.storeId}:${damascusDay().toISOString().slice(0, 10)}`,
          grouped: (count) => ({
            title: `جديد من ${store}`,
            body: `أضاف ${store} ${count} منتجات جديدة اليوم`,
          }),
        },
      );
    })().catch((e) =>
      this.log.error('productCreated failed', (e as Error).stack),
    );
  }

  /** Price drops, new discounts and restocks, compared with the product before the merchant's edit. */
  productChanged(productId: string, before: ProductSnapshot) {
    void (async () => {
      const product = await this.publicProduct(productId);
      if (!product) return;
      const after = await this.prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: {
          price: true,
          oldPrice: true,
          currency: true,
          priceType: true,
          inStock: true,
          status: true,
        },
      });
      const title = trimTitle(product.title);
      const url = `/products/${product.id}`;
      const priced = (p: ProductSnapshot) =>
        p.priceType !== 'ON_REQUEST' && p.price !== null;
      const priceDropped =
        priced(before) &&
        priced(after) &&
        before.currency === after.currency &&
        after.price! < before.price!;
      const newDiscount =
        priced(after) && !!after.oldPrice && (!before.oldPrice || priceDropped);
      const restocked = !before.inStock && after.inStock;
      const wasHidden = before.status !== 'ACTIVE';

      const favoriters = (
        await this.prisma.favorite.findMany({
          where: { productId },
          select: { userId: true },
        })
      ).map((f) => f.userId);

      if (priceDropped && !wasHidden) {
        this.notifications.notify(favoriters, {
          category: 'FAVORITES',
          type: 'product.price_drop',
          title: `انخفض سعر ${title}`,
          body: `من ${money(before.price!, before.currency)} إلى ${money(after.price!, after.currency)}`,
          url,
          groupKey: `price:${productId}`,
        });
      } else if (restocked && !wasHidden) {
        this.notifications.notify(favoriters, {
          category: 'FAVORITES',
          type: 'product.restocked',
          title: `${title} متوفر من جديد`,
          body: `عاد متوفراً لدى ${product.store.name}`,
          url,
          groupKey: `stock:${productId}`,
        });
      }

      if (newDiscount && !wasHidden) {
        const followers = await this.prisma.storeFollow.findMany({
          // Buyers who saved the product already heard about the price
          where: {
            storeId: product.storeId,
            ...(priceDropped ? { userId: { notIn: favoriters } } : {}),
          },
          select: { userId: true },
        });
        const percent = Math.round((1 - after.price! / after.oldPrice!) * 100);
        const store = product.store.name;
        this.notifications.notify(
          followers.map((f) => f.userId),
          {
            category: 'FOLLOWING',
            type: 'product.offer',
            title: `عرض من ${store}: خصم ${percent}٪`,
            body: `${title} بسعر ${money(after.price!, after.currency)}`,
            url,
            groupKey: `store-offers:${product.storeId}:${damascusDay().toISOString().slice(0, 10)}`,
            grouped: (count) => ({
              title: `عروض من ${store}`,
              body: `${count} عروض جديدة اليوم لدى ${store}`,
            }),
          },
        );
      }
    })().catch((e) =>
      this.log.error('productChanged failed', (e as Error).stack),
    );
  }

  // ---------- hourly reminders ----------

  async runReminders() {
    try {
      await this.reviewInvites();
      await this.verificationExpiryReminders();
    } catch (e) {
      this.log.error('Reminders failed', (e as Error).stack);
    }
  }

  /** A day after a buyer contacts a store, invite them once to review it (if they haven't). */
  private async reviewInvites() {
    const now = Date.now();
    const contacts = await this.prisma.storeContact.findMany({
      where: {
        firstContactAt: {
          lte: new Date(now - REVIEW_INVITE_AFTER_MS),
          gte: new Date(now - REVIEW_INVITE_UNTIL_MS),
        },
        store: publicStoreWhere,
      },
      select: {
        buyerId: true,
        storeId: true,
        store: { select: { name: true, slug: true } },
      },
      take: 500,
      orderBy: { firstContactAt: 'asc' },
    });
    for (const c of contacts) {
      const reviewed = await this.prisma.review.findUnique({
        where: { storeId_buyerId: { storeId: c.storeId, buyerId: c.buyerId } },
        select: { id: true },
      });
      if (reviewed) continue;
      await this.notifications.deliver([c.buyerId], {
        category: 'INVITES',
        type: 'review.invite',
        title: `كيف كانت تجربتك مع ${c.store.name}؟`,
        body: 'تقييمك يساعد غيرك على اختيار التاجر المناسب',
        url: `/stores/${c.store.slug}#reviews`,
        groupKey: `review-invite:${c.storeId}`,
        once: true,
      });
    }
  }

  /** Shop verification lasts a year: remind the merchant once, a month before it ends. */
  private async verificationExpiryReminders() {
    const now = Date.now();
    const stores = await this.prisma.store.findMany({
      where: {
        verificationExpiresAt: {
          gt: new Date(now),
          lte: new Date(now + EXPIRY_REMINDER_DAYS * DAY_MS),
        },
      },
      select: { id: true, ownerId: true, verificationExpiresAt: true },
      take: 500,
    });
    for (const s of stores) {
      const days = Math.max(
        1,
        Math.ceil((s.verificationExpiresAt!.getTime() - now) / DAY_MS),
      );
      await this.notifications.deliver([s.ownerId], {
        category: 'ACCOUNT',
        type: 'verification.expiring',
        title: 'توثيق محلك ينتهي قريباً',
        body: `ينتهي توثيق المحل خلال ${days} يوماً. جدّده بفيديو جديد حتى تبقى الشارة ظاهرة`,
        url: '/dashboard/verification',
        groupKey: `verification-expiry:${s.id}:${s.verificationExpiresAt!.toISOString().slice(0, 10)}`,
        once: true,
        urgent: true,
      });
    }
  }
}
