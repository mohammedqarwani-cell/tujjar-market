import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus, ReportStatus, StoreStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeArabic } from '../common/text/arabic';
import { pageResult, paging } from '../common/pagination';

const searchTerms = (q?: string) =>
  normalizeArabic(q).split(' ').filter((t) => t.length > 1).slice(0, 5);

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const [stores, suspended, unverified, products, underReview, openReports, merchants] = await Promise.all([
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.store.count({ where: { isVerified: false, status: 'ACTIVE' } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'UNDER_REVIEW' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.user.count({ where: { role: 'MERCHANT' } }),
    ]);
    return { stores, suspended, unverified, products, underReview, openReports, merchants };
  }

  async stores(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.StoreWhereInput = {};
    if (query.status === 'ACTIVE' || query.status === 'SUSPENDED') where.status = query.status as StoreStatus;
    if (query.verified === '0') where.isVerified = false;
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
          isVerified: true,
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

  updateStore(id: string, data: { isVerified?: boolean; status?: StoreStatus }) {
    return this.prisma.store.update({
      where: { id },
      data,
      select: { id: true, isVerified: true, status: true },
    });
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

  updateProduct(id: string, data: { isFeatured?: boolean; status?: ProductStatus }) {
    return this.prisma.product.update({
      where: { id },
      data,
      select: { id: true, isFeatured: true, status: true },
    });
  }

  async reports(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const status = (['OPEN', 'RESOLVED', 'DISMISSED'].includes(query.status) ? query.status : 'OPEN') as ReportStatus;
    const where: Prisma.ReportWhereInput = { status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: {
          store: { select: { slug: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.report.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  updateReport(id: string, status: ReportStatus) {
    return this.prisma.report.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  }
}
