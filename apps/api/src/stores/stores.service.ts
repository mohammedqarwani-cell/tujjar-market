import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildSearchText, normalizeArabic } from '../common/text/arabic';
import { normalizeSyrianMobile, normalizeSyrianPhone } from '../common/text/phone';
import { pageResult, paging } from '../common/pagination';
import { storeCardSelect } from '../common/selects';
import { UpdateStoreDto } from './store.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: Prisma.StoreWhereInput = { status: 'ACTIVE' };
    if (query.gov) where.governorate = { slug: query.gov };
    if (query.market) where.market = { slug: query.market };
    if (query.category) where.category = { slug: query.category };
    const terms = normalizeArabic(query.q).split(' ').filter((t) => t.length > 1).slice(0, 5);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        select: storeCardSelect,
        orderBy: [{ isVerified: 'desc' }, { contactsCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.store.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async bySlug(slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: {
        ...storeCardSelect,
        description: true,
        address: true,
        mapUrl: true,
        whatsapp: true,
        phone: true,
        openingHours: true,
        createdAt: true,
        governorate: { select: { slug: true, name: true } },
        market: { select: { slug: true, name: true } },
      },
    });
    if (!store) throw new NotFoundException('المتجر غير موجود');

    const productCategories = await this.prisma.category.findMany({
      where: { products: { some: { storeId: store.id, status: 'ACTIVE' } } },
      select: { slug: true, name: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { ...store, productCategories };
  }

  async ownedBy(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      include: {
        governorate: { select: { id: true, slug: true, name: true } },
        market: { select: { id: true, slug: true, name: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
        _count: { select: { products: true } },
      },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    const { searchText, ...rest } = store;
    return rest;
  }

  async update(userId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');

    const whatsapp = normalizeSyrianMobile(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException('رقم الواتساب غير صحيح، مثال: 0912345678');
    const phone = dto.phone ? normalizeSyrianPhone(dto.phone) : null;
    if (dto.phone && !phone) throw new BadRequestException('رقم الهاتف غير صحيح');

    const [governorate, market, category] = await Promise.all([
      this.prisma.governorate.findUnique({ where: { id: dto.governorateId } }),
      dto.marketId ? this.prisma.market.findUnique({ where: { id: dto.marketId } }) : null,
      dto.categoryId ? this.prisma.category.findUnique({ where: { id: dto.categoryId } }) : null,
    ]);
    if (!governorate) throw new BadRequestException('اختر المحافظة');
    if (dto.marketId && market?.governorateId !== governorate.id) {
      throw new BadRequestException('السوق لا يتبع المحافظة المختارة');
    }

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: dto.name.trim(),
        tagline: dto.tagline?.trim() || null,
        description: dto.description?.trim() || null,
        governorateId: governorate.id,
        marketId: market?.id ?? null,
        categoryId: category?.id ?? null,
        address: dto.address?.trim() || null,
        mapUrl: dto.mapUrl || null,
        whatsapp,
        phone,
        openingHours: dto.openingHours?.trim() || null,
        logoUrl: dto.logoUrl || null,
        coverUrl: dto.coverUrl || null,
        hasDelivery: dto.hasDelivery,
        searchText: buildSearchText(
          dto.name, dto.tagline, dto.description, market?.name, governorate.name, category?.name,
        ),
      },
    });
    return this.ownedBy(userId);
  }
}
