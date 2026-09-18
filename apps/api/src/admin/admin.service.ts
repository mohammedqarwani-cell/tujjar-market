import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, ReportStatus, StoreStatus, VerificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { normalizeArabic } from '../common/text/arabic';
import { pageResult, paging } from '../common/pagination';
import { VerificationService } from '../verification/verification.service';
import { LEVELS } from '../verification/verification.levels';
import { ReviewsService } from '../reviews/reviews.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  REPORT_BLOCK_DAYS,
  REPORT_BLOCK_MIN_DISMISSED,
  REPORT_BLOCK_SCORE,
  isTrustedReporter,
  reporterCredibility,
} from '../reports/credibility';

const searchTerms = (q?: string) =>
  normalizeArabic(q).split(' ').filter((t) => t.length > 1).slice(0, 5);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private verification: VerificationService,
    private reviews: ReviewsService,
    private notifications: NotificationsService,
  ) {}

  async overview() {
    const [
      stores,
      suspended,
      unverified,
      pendingVerifications,
      products,
      underReview,
      openReports,
      merchants,
      buyers,
      reviewsToModerate,
    ] = await Promise.all([
        this.prisma.store.count(),
        this.prisma.store.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.store.count({ where: { verificationLevel: 'REGISTERED', status: 'ACTIVE' } }),
        this.prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: 'UNDER_REVIEW' } }),
        this.prisma.report.count({ where: { status: 'OPEN' } }),
        this.prisma.user.count({ where: { role: 'MERCHANT' } }),
        this.prisma.user.count({ where: { role: 'BUYER' } }),
        this.reviews.pendingCount(),
      ]);
    return {
      stores,
      suspended,
      unverified,
      pendingVerifications,
      products,
      underReview,
      openReports,
      merchants,
      buyers,
      reviewsToModerate,
    };
  }

  async stores(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.StoreWhereInput = {};
    if (query.status === 'ACTIVE' || query.status === 'SUSPENDED') where.status = query.status as StoreStatus;
    if (LEVELS.includes(query.level as VerificationLevel)) where.verificationLevel = query.level as VerificationLevel;
    if (query.badge === 'suspended') where.badgeSuspendedAt = { not: null };
    const terms = searchTerms(query.q);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          whatsapp: true,
          verificationLevel: true,
          earnedLevel: true,
          badgeSuspendedAt: true,
          verificationExpiresAt: true,
          status: true,
          createdAt: true,
          contactsCount: true,
          owner: { select: { name: true, phone: true } },
          governorate: { select: { name: true } },
          market: { select: { name: true } },
          _count: { select: { products: true, reports: { where: { status: 'OPEN' } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.store.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async setStoreStatus(actorId: string, id: string, status: StoreStatus, ip: string) {
    const before = await this.prisma.store.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new NotFoundException('المتجر غير موجود');
    const { ownerId, ...store } = await this.prisma.store.update({
      where: { id },
      data: { status },
      select: { id: true, verificationLevel: true, status: true, ownerId: true },
    });
    await this.audit.log({ actorId, action: status === 'SUSPENDED' ? 'store.suspend' : 'store.reactivate', entityType: 'store', entityId: id, ip });
    if (before.status !== status) {
      this.notifications.notify(ownerId, {
        category: 'ACCOUNT',
        type: status === 'SUSPENDED' ? 'store.suspended' : 'store.reactivated',
        title: status === 'SUSPENDED' ? 'أُوقف متجرك مؤقتاً' : 'أُعيد تفعيل متجرك ✓',
        body:
          status === 'SUSPENDED'
            ? 'متجرك ومنتجاتك مخفية عن الزبائن حالياً. تواصل مع الإدارة لمعرفة السبب'
            : 'متجرك ومنتجاتك ظاهرة للزبائن من جديد',
        url: '/dashboard',
        urgent: true,
      });
    }
    return store;
  }

  async products(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.ProductWhereInput = {};
    if (['ACTIVE', 'HIDDEN', 'UNDER_REVIEW'].includes(query.status)) where.status = query.status as ProductStatus;
    const terms = searchTerms(query.q);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          priceType: true,
          images: true,
          status: true,
          riskScore: true,
          isFeatured: true,
          createdAt: true,
          store: { select: { slug: true, name: true } },
          category: { select: { name: true, icon: true } },
        },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async updateProduct(actorId: string, id: string, data: { isFeatured?: boolean; status?: ProductStatus }, ip: string) {
    const before = await this.prisma.product.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new NotFoundException('المنتج غير موجود');
    const { title, store, ...product } = await this.prisma.product.update({
      where: { id },
      data,
      select: { id: true, isFeatured: true, status: true, title: true, store: { select: { ownerId: true } } },
    });
    await this.audit.log({ actorId, action: 'product.moderate', entityType: 'product', entityId: id, meta: data, ip });
    if (data.status && data.status !== before.status && data.status !== 'UNDER_REVIEW') {
      const hidden = data.status === 'HIDDEN';
      this.notifications.notify(store.ownerId, {
        category: 'ACCOUNT',
        type: hidden ? 'product.hidden' : 'product.approved',
        title: hidden ? 'أُخفي أحد منتجاتك' : 'نُشر منتجك بعد المراجعة ✓',
        body: hidden ? `«${title}» مخالف لشروط النشر وأُخفي عن الزبائن` : `«${title}» ظاهر الآن للزبائن`,
        url: `/dashboard/products/${id}`,
        urgent: hidden,
      });
    }
    return product;
  }

  /** Permanent removal, for junk or unlawful listings; the merchant is told why. */
  async deleteProduct(actorId: string, id: string, ip: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { title: true, store: { select: { id: true, name: true, ownerId: true } } } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    await this.prisma.product.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'product.deleted', entityType: 'product', entityId: id, meta: { title: product.title, storeId: product.store.id }, ip });
    this.notifications.notify(product.store.ownerId, {
      category: 'ACCOUNT',
      type: 'product.deleted',
      title: 'حُذف أحد منتجاتك',
      body: `«${product.title}» حُذف من المنصة لمخالفته شروط النشر`,
      url: '/dashboard/products',
      urgent: true,
    });
    return { ok: true };
  }

  async reports(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const status = (['OPEN', 'RESOLVED', 'DISMISSED'].includes(query.status) ? query.status : 'OPEN') as ReportStatus;
    const where: Prisma.ReportWhereInput = { status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: { id: true, name: true, phone: true, reportsConfirmed: true, reportsDismissed: true, reportingBlockedUntil: true },
          },
          store: { select: { slug: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.report.count({ where }),
    ]);
    // Moderators see how often each reporter was right before
    const withCredibility = items.map((item) => {
      const { reportsConfirmed: confirmed, reportsDismissed: dismissed, reportingBlockedUntil } = item.reporter;
      return {
        ...item,
        reporter: {
          ...item.reporter,
          credibility: Math.round(reporterCredibility(confirmed, dismissed) * 100),
          trusted: isTrustedReporter(confirmed, dismissed),
          blocked: !!reportingBlockedUntil && reportingBlockedUntil > new Date(),
        },
      };
    });
    return pageResult(withCredibility, total, page, pageSize);
  }

  async updateReport(actorId: string, id: string, status: ReportStatus, ip: string) {
    const before = await this.prisma.report.findUnique({ where: { id }, select: { status: true, reporterId: true } });
    if (!before) throw new NotFoundException('البلاغ غير موجود');
    const report = await this.prisma.report.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, storeId: true },
    });
    await this.audit.log({ actorId, action: `report.${status.toLowerCase()}`, entityType: 'report', entityId: id, ip });
    if (before.status === 'OPEN' && status !== 'OPEN') {
      this.notifications.notify(before.reporterId, {
        category: 'ACCOUNT',
        type: status === 'RESOLVED' ? 'report.resolved' : 'report.dismissed',
        title: status === 'RESOLVED' ? 'شكراً لبلاغك ✓' : 'راجعنا بلاغك',
        body:
          status === 'RESOLVED'
            ? 'تحققنا من بلاغك واتخذنا الإجراء المناسب. بلاغاتك تساعد في حماية الجميع'
            : 'لم نجد مخالفة تستدعي إجراءً في هذا البلاغ',
        url: '/notifications',
      });
    }
    if (before.status !== status) await this.updateReporterCredibility(actorId, before.reporterId, before.status, status, ip);
    // A confirmed report counts towards automatically suspending the store's verification badge
    if (status === 'RESOLVED' && report.storeId) await this.verification.applyReportThreshold(report.storeId);
    return { id: report.id, status: report.status };
  }

  /** Keeps each reporter's confirmed and dismissed tally; persistent false reporting pauses their reporting. */
  private async updateReporterCredibility(actorId: string, reporterId: string, from: ReportStatus, to: ReportStatus, ip: string) {
    const counter = (status: ReportStatus, step: number): Prisma.UserUpdateInput =>
      status === 'RESOLVED'
        ? { reportsConfirmed: { increment: step } }
        : status === 'DISMISSED'
          ? { reportsDismissed: { increment: step } }
          : {};
    const user = await this.prisma.user.update({
      where: { id: reporterId },
      data: { ...counter(from, -1), ...counter(to, 1) },
      select: { reportsConfirmed: true, reportsDismissed: true, reportingBlockedUntil: true },
    });
    if (to !== 'DISMISSED') return;

    const score = reporterCredibility(user.reportsConfirmed, user.reportsDismissed);
    const alreadyBlocked = !!user.reportingBlockedUntil && user.reportingBlockedUntil > new Date();
    if (user.reportsDismissed < REPORT_BLOCK_MIN_DISMISSED || score >= REPORT_BLOCK_SCORE || alreadyBlocked) return;
    await this.prisma.user.update({
      where: { id: reporterId },
      data: { reportingBlockedUntil: new Date(Date.now() + REPORT_BLOCK_DAYS * 86_400_000) },
    });
    await this.audit.log({
      actorId,
      action: 'user.reporting_blocked',
      entityType: 'user',
      entityId: reporterId,
      meta: { confirmed: user.reportsConfirmed, dismissed: user.reportsDismissed, score: Math.round(score * 100) },
      ip,
    });
    this.notifications.notify(reporterId, {
      category: 'ACCOUNT',
      type: 'user.reporting_blocked',
      title: 'أُوقفت البلاغات من حسابك مؤقتاً',
      body: `تكررت البلاغات غير الصحيحة، فلا يمكنك الإبلاغ لمدة ${REPORT_BLOCK_DAYS} يوماً`,
      url: '/notifications',
      urgent: true,
    });
  }

  async auditLogs(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }
}
