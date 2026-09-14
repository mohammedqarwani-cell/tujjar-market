import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type FindAllArgs = {
  limit?: number;
  hasImageOnly?: boolean;
  city?: string; // اسم المدينة (Damascus / Abu Dhabi ...)
  market?: string; // اسم السوق (Al-Hamidiya / Dubai Mall ...)
};

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(args?: FindAllArgs) {
    const where: any = {
      ...(args?.hasImageOnly ? { imageUrl: { not: null } } : {}),
      ...(args?.city ? { city: { name: { equals: args.city } } } : {}),
      ...(args?.market ? { market: { name: { equals: args.market } } } : {}),
    };

    const rows = await this.prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args?.limit ?? 50, 100),
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        city: { select: { name: true } },
        market: { select: { name: true } },
      },
    });

    // نحافظ على الواجهة القديمة: city/market كسلاسل نصية
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrl: r.imageUrl,
      city: r.city?.name ?? null,
      market: r.market?.name ?? null,
    }));
  }

  // إيجاد متجر عبر الـ slug
  findBySlug(slug: string) {
    return this.prisma.store
      .findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          city: { select: { name: true } },
          market: { select: { name: true } },
        },
      })
      .then(
        (r) =>
          r && {
            id: r.id,
            name: r.name,
            slug: r.slug,
            imageUrl: r.imageUrl,
            city: r.city?.name ?? null,
            market: r.market?.name ?? null,
          },
      );
  }

  // إنشاء متجر مملوك لمستخدم (باستخدام cityId/marketId الجديدة)
  createForOwner(
    ownerId: string,
    data: { name: string; slug: string; cityId?: string; marketId?: string },
  ) {
    return this.prisma.store
      .create({
        data: {
          ownerId,
          name: data.name,
          slug: data.slug,
          cityId: data.cityId ?? null,
          marketId: data.marketId ?? null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          city: { select: { name: true } },
          market: { select: { name: true } },
        },
      })
      .then((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        city: r.city?.name ?? null,
        market: r.market?.name ?? null,
      }));
  }
}
