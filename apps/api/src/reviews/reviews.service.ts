import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { pageResult, paging } from '../common/pagination';
import { publicStoreWhere } from '../common/selects';
import { normalizeArabic, toLatinDigits } from '../common/text/arabic';
import { ModerateReviewDto, ReviewInputDto } from './reviews.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { damascusDay } from '../common/pagination';

/** A review needs a contact made from the store page, and not in the same minutes as that contact */
export const REVIEW_CONTACT_COOLDOWN_MS = 30 * 60_000;
const REVIEW_CONTACT_VALID_DAYS = 180;
const DAY_MS = 86_400_000;

type Ineligible = 'OWN_STORE' | 'NO_CONTACT' | 'CONTACT_TOO_OLD' | 'TOO_SOON';

const INELIGIBLE_MESSAGES: Record<Ineligible, string> = {
  OWN_STORE: 'لا يمكن تقييم متجر مرتبط برقم موبايلك',
  NO_CONTACT: 'التقييم متاح لمن تواصل مع المتجر عبر واتساب أو اتصال من صفحته في تُجّار ماركت',
  CONTACT_TOO_OLD: 'مضى أكثر من 6 أشهر على آخر تواصل لك مع هذا المتجر',
  TOO_SOON: 'يمكنك التقييم بعد نصف ساعة من أول تواصل مع المتجر',
};

/** Content that holds a review for a moderator instead of publishing it straight away */
const HOLD_RULES: { pattern: RegExp; note: string }[] = [
  { pattern: /(https?:\/\/|www\.|t\.me\/|wa\.me\/|\.(com|net|org|sy)\b)/i, note: 'يحتوي رابطاً' },
  { pattern: /(\+|00)?9\d(?:[\s.-]?\d){7,}|\d{9,}/, note: 'يحتوي رقم هاتف' },
  { pattern: /(سلاح|مسدس|ذخير|مخدر|حشيش|كبتاغون)/, note: 'يذكر مواد ممنوعة' },
];

/** Public reviews show a first name and an initial, never the full name or the phone number. */
export function maskName(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${[...second][0]}.` : first;
}

const publicReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  merchantReply: true,
  merchantRepliedAt: true,
  createdAt: true,
  updatedAt: true,
  buyer: { select: { name: true } },
} satisfies Prisma.ReviewSelect;

type PublicStore = { id: string; whatsapp: string; phone: string | null; owner: { phone: string } };

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private async publicStore(slug: string): Promise<PublicStore> {
    const store = await this.prisma.store.findFirst({
      where: { slug, ...publicStoreWhere },
      select: { id: true, whatsapp: true, phone: true, owner: { select: { phone: true } } },
    });
    if (!store) throw new NotFoundException('المتجر غير موجود');
    return store;
  }

  // ---------- public ----------

  async list(slug: string, query: Record<string, string>) {
    const store = await this.publicStore(slug);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const where: Prisma.ReviewWhereInput = { storeId: store.id, status: 'PUBLISHED' };
    const [items, total, grouped] = await Promise.all([
      this.prisma.review.findMany({ where, select: publicReviewSelect, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    ]);
    const distribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: grouped.find((g) => g.rating === rating)?._count._all ?? 0,
    }));
    const sum = grouped.reduce((s, g) => s + g.rating * g._count._all, 0);
    return {
      ...pageResult(
        items.map(({ buyer, ...review }) => ({ ...review, author: maskName(buyer.name) })),
        total,
        page,
        pageSize,
      ),
      summary: { average: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution },
    };
  }

  // ---------- buyer ----------

  private async ineligibility(
    buyerId: string,
    store: PublicStore,
  ): Promise<{ reason: Ineligible | null; availableAt: Date | null }> {
    const [buyer, contact] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: buyerId }, select: { phone: true } }),
      this.prisma.storeContact.findUnique({
        where: { storeId_buyerId: { storeId: store.id, buyerId } },
        select: { firstContactAt: true, lastContactAt: true },
      }),
    ]);
    // A merchant can't rate their own shop from a second account that uses the shop's numbers
    if (buyer && [store.whatsapp, store.phone, store.owner.phone].includes(buyer.phone)) {
      return { reason: 'OWN_STORE', availableAt: null };
    }
    if (!contact) return { reason: 'NO_CONTACT', availableAt: null };
    if (contact.lastContactAt.getTime() < Date.now() - REVIEW_CONTACT_VALID_DAYS * DAY_MS) {
      return { reason: 'CONTACT_TOO_OLD', availableAt: null };
    }
    const availableAt = new Date(contact.firstContactAt.getTime() + REVIEW_CONTACT_COOLDOWN_MS);
    if (availableAt.getTime() > Date.now()) return { reason: 'TOO_SOON', availableAt };
    return { reason: null, availableAt: null };
  }

  async mine(buyerId: string, slug: string) {
    const store = await this.publicStore(slug);
    const [check, review] = await Promise.all([
      this.ineligibility(buyerId, store),
      this.prisma.review.findUnique({
        where: { storeId_buyerId: { storeId: store.id, buyerId } },
        select: { id: true, rating: true, comment: true, status: true, merchantReply: true, createdAt: true, updatedAt: true },
      }),
    ]);
    // An existing review can always be edited or removed, unless it sits on the buyer's own store
    const canReview = check.reason === null || (!!review && check.reason !== 'OWN_STORE');
    return {
      canReview,
      reason: canReview ? null : check.reason,
      message: canReview || !check.reason ? null : INELIGIBLE_MESSAGES[check.reason],
      availableAt: canReview ? null : check.availableAt,
      review,
    };
  }

  async submit(buyerId: string, slug: string, dto: ReviewInputDto, ip: string) {
    const store = await this.publicStore(slug);
    const existing = await this.prisma.review.findUnique({
      where: { storeId_buyerId: { storeId: store.id, buyerId } },
      select: { id: true, status: true },
    });
    const check = await this.ineligibility(buyerId, store);
    if (check.reason && !(existing && check.reason !== 'OWN_STORE')) {
      throw new ForbiddenException({ statusCode: 403, message: INELIGIBLE_MESSAGES[check.reason], code: check.reason });
    }

    const comment = dto.comment?.trim() || null;
    const hold = comment
      ? HOLD_RULES.find((rule) => rule.pattern.test(`${toLatinDigits(comment)} ${normalizeArabic(comment)}`))
      : undefined;
    // Editing a review a moderator hid sends it back to moderation instead of republishing it
    const reheld = existing?.status === 'HIDDEN';
    const status: ReviewStatus = hold || reheld ? 'UNDER_REVIEW' : 'PUBLISHED';
    const moderationNote = hold ? `محجوز تلقائياً: ${hold.note}` : reheld ? 'عُدّل بعد إخفائه من الإدارة' : null;
    const data = { rating: dto.rating, comment, status, moderationNote };

    const review = await this.prisma.review.upsert({
      where: { storeId_buyerId: { storeId: store.id, buyerId } },
      create: { storeId: store.id, buyerId, ...data },
      update: data,
      select: { id: true, rating: true, comment: true, status: true, createdAt: true, updatedAt: true },
    });
    await this.recalculate(store.id);
    await this.audit.log({
      actorId: buyerId,
      action: existing ? 'review.updated' : 'review.created',
      entityType: 'review',
      entityId: review.id,
      meta: { storeId: store.id, rating: dto.rating, status },
      ip,
    });
    if (status === 'PUBLISHED' && !existing) this.announceReview(store.id, dto.rating);
    if (status === 'UNDER_REVIEW') {
      this.notifications.notifyStaff({
        category: 'MODERATION',
        type: 'review.held',
        title: 'تقييم محجوز ينتظر المراجعة',
        body: moderationNote ?? 'تقييم يحتاج مراجعة',
        url: '/admin?tab=reviews',
        groupKey: `queue-reviews:${damascusDay().toISOString().slice(0, 10)}`,
        grouped: (count) => ({ title: 'تقييمات تنتظر المراجعة', body: `${count} تقييمات محجوزة اليوم` }),
      });
    }
    return review;
  }

  /** Tells the merchant about a new published review, grouped per day. */
  private announceReview(storeId: string, rating: number) {
    void this.prisma.store
      .findUnique({ where: { id: storeId }, select: { ownerId: true } })
      .then((store) =>
        this.notifications.notify(store?.ownerId, {
          category: 'REVIEWS',
          type: 'review.new',
          title: `تقييم جديد لمتجرك: ${'★'.repeat(rating)}`,
          body: 'اطّلع على التقييم وردّ على الزبون',
          url: '/dashboard/reviews',
          groupKey: `reviews:${storeId}:${damascusDay().toISOString().slice(0, 10)}`,
          grouped: (count) => ({ title: 'تقييمات جديدة لمتجرك', body: `وصلك ${count} تقييمات جديدة اليوم` }),
        }),
      );
  }

  async removeMine(buyerId: string, slug: string, ip: string) {
    const store = await this.publicStore(slug);
    const review = await this.prisma.review.findUnique({
      where: { storeId_buyerId: { storeId: store.id, buyerId } },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('لا يوجد تقييم لك على هذا المتجر');
    await this.prisma.review.delete({ where: { id: review.id } });
    await this.recalculate(store.id);
    await this.audit.log({
      actorId: buyerId,
      action: 'review.deleted',
      entityType: 'review',
      entityId: review.id,
      meta: { storeId: store.id },
      ip,
    });
  }

  /** The store rating counts published reviews only. */
  async recalculate(storeId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { storeId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.store.update({
      where: { id: storeId },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all },
    });
  }

  // ---------- merchant ----------

  private async ownStore(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: { id: true, ratingAvg: true, ratingCount: true },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }

  async merchantList(userId: string, query: Record<string, string>) {
    const store = await this.ownStore(userId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const where: Prisma.ReviewWhereInput = { storeId: store.id };
    if (['PUBLISHED', 'UNDER_REVIEW', 'HIDDEN'].includes(query.status)) where.status = query.status as ReviewStatus;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: { ...publicReviewSelect, status: true, flagOpen: true, flagReason: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      ...pageResult(
        items.map(({ buyer, ...review }) => ({ ...review, author: maskName(buyer.name) })),
        total,
        page,
        pageSize,
      ),
      summary: { average: store.ratingAvg, count: store.ratingCount },
    };
  }

  private async ownReview(userId: string, id: string) {
    const store = await this.ownStore(userId);
    const review = await this.prisma.review.findFirst({
      where: { id, storeId: store.id },
      select: { id: true, status: true, flagOpen: true },
    });
    if (!review) throw new NotFoundException('التقييم غير موجود');
    return review;
  }

  async reply(userId: string, id: string, reply: string, ip: string) {
    const review = await this.ownReview(userId, id);
    if (review.status !== 'PUBLISHED') throw new BadRequestException('يمكن الرد على التقييمات المنشورة فقط');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { merchantReply: reply.trim(), merchantRepliedAt: new Date() },
      select: { id: true, merchantReply: true, merchantRepliedAt: true },
    });
    await this.audit.log({ actorId: userId, action: 'review.replied', entityType: 'review', entityId: id, ip });
    void this.prisma.review
      .findUnique({ where: { id }, select: { buyerId: true, store: { select: { name: true, slug: true } } } })
      .then((r) =>
        r &&
        this.notifications.notify(r.buyerId, {
          category: 'ACCOUNT',
          type: 'review.replied',
          title: `ردّ ${r.store.name} على تقييمك`,
          body: reply.trim().slice(0, 120),
          url: `/stores/${r.store.slug}#reviews`,
          groupKey: `review-reply:${id}`,
        }),
      );
    return updated;
  }

  /** A merchant can ask for moderation but can't hide a review; it stays public until a moderator decides. */
  async flag(userId: string, id: string, reason: string, ip: string) {
    const review = await this.ownReview(userId, id);
    if (review.flagOpen) throw new ConflictException('طلبت مراجعة هذا التقييم مسبقاً، وهو لدى الإدارة');
    await this.prisma.review.update({
      where: { id },
      data: { flagOpen: true, flagReason: reason.trim(), flaggedAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'review.flagged',
      entityType: 'review',
      entityId: id,
      meta: { reason: reason.trim() },
      ip,
    });
    this.notifications.notifyStaff({
      category: 'MODERATION',
      type: 'review.flagged',
      title: 'تاجر يطلب مراجعة تقييم',
      body: reason.trim().slice(0, 120),
      url: '/admin?tab=reviews',
      groupKey: `queue-reviews:${damascusDay().toISOString().slice(0, 10)}`,
      grouped: (count) => ({ title: 'تقييمات تنتظر المراجعة', body: `${count} تقييمات بانتظار قرار اليوم` }),
    });
    return { id, flagOpen: true };
  }

  // ---------- admin ----------

  async adminList(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 50);
    const status = (['PUBLISHED', 'UNDER_REVIEW', 'HIDDEN'].includes(query.status) ? query.status : 'UNDER_REVIEW') as ReviewStatus;
    const where: Prisma.ReviewWhereInput = query.flagged === '1' ? { flagOpen: true } : { status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          storeId: true,
          buyerId: true,
          rating: true,
          comment: true,
          status: true,
          moderationNote: true,
          merchantReply: true,
          flagOpen: true,
          flagReason: true,
          flaggedAt: true,
          moderatedAt: true,
          createdAt: true,
          updatedAt: true,
          buyer: { select: { name: true, phone: true, createdAt: true } },
          store: { select: { slug: true, name: true } },
          moderatedBy: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ]);

    // How the buyer reached the store, so moderators can judge whether a review is genuine
    const contacts = items.length
      ? await this.prisma.storeContact.findMany({
          where: { OR: items.map((r) => ({ storeId: r.storeId, buyerId: r.buyerId })) },
          select: { storeId: true, buyerId: true, firstContactAt: true, lastContactAt: true, contacts: true },
        })
      : [];
    const withContact = items.map(({ storeId, buyerId, ...review }) => {
      const contact = contacts.find((c) => c.storeId === storeId && c.buyerId === buyerId);
      return {
        ...review,
        contact: contact
          ? { firstContactAt: contact.firstContactAt, lastContactAt: contact.lastContactAt, contacts: contact.contacts }
          : null,
      };
    });
    return pageResult(withContact, total, page, pageSize);
  }

  async moderate(actorId: string, id: string, dto: ModerateReviewDto, ip: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { storeId: true, status: true, flagOpen: true, buyerId: true, store: { select: { ownerId: true, name: true, slug: true } } },
    });
    if (!review) throw new NotFoundException('التقييم غير موجود');
    const note = dto.note?.trim() || null;
    if (dto.status === 'HIDDEN' && (!note || note.length < 5)) {
      throw new BadRequestException('اكتب سبب الإخفاء (5 أحرف على الأقل)');
    }
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: dto.status, moderationNote: note, flagOpen: false, moderatedById: actorId, moderatedAt: new Date() },
      select: { id: true, status: true, flagOpen: true },
    });
    await this.recalculate(review.storeId);
    await this.audit.log({
      actorId,
      action: dto.status === 'HIDDEN' ? 'review.hidden' : 'review.published',
      entityType: 'review',
      entityId: id,
      meta: { note },
      ip,
    });
    if (review.status !== dto.status) {
      this.notifications.notify(review.buyerId, {
        category: 'ACCOUNT',
        type: dto.status === 'HIDDEN' ? 'review.hidden' : 'review.published',
        title: dto.status === 'HIDDEN' ? 'أُخفي تقييمك' : 'نُشر تقييمك',
        body:
          dto.status === 'HIDDEN'
            ? `راجعت الإدارة تقييمك على ${review.store.name} ولم يُنشر لمخالفته إرشادات التقييم`
            : `تقييمك على ${review.store.name} ظاهر الآن للجميع`,
        url: `/stores/${review.store.slug}#reviews`,
      });
    }
    if (review.flagOpen) {
      this.notifications.notify(review.store.ownerId, {
        category: 'ACCOUNT',
        type: 'review.flag_decided',
        title: 'قرار الإدارة على التقييم الذي طلبت مراجعته',
        body: dto.status === 'HIDDEN' ? 'أُخفي التقييم بعد المراجعة' : 'بقي التقييم منشوراً بعد المراجعة',
        url: '/dashboard/reviews',
        urgent: true,
      });
    }
    return updated;
  }

  pendingCount() {
    return this.prisma.review.count({ where: { OR: [{ status: 'UNDER_REVIEW' }, { flagOpen: true }] } });
  }
}
