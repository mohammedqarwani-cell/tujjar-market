import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Controller('catalog/meta')
export class MetaController {
  constructor(private prisma: PrismaService) {}

  // === أكثر المدن التي فيها متاجر ===
  @Get('cities')
  async topCities() {
    const rows = await this.prisma.store.groupBy({
      by: ['cityId'],
      where: { cityId: { not: null } },
      _count: { cityId: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: 20,
    });

    // جلب أسماء المدن من الجدول المرتبط
    const cities = await this.prisma.city.findMany({
      where: { id: { in: rows.map((r) => r.cityId!) } },
      select: { id: true, name: true },
    });

    return rows.map((r) => ({
      name: cities.find((c) => c.id === r.cityId)?.name || 'Unknown',
      count: r._count.cityId || 0,
    }));
  }

  // === أكثر الأسواق شيوعًا ===
  @Get('markets')
  async topMarkets() {
    const rows = await this.prisma.store.groupBy({
      by: ['marketId'],
      where: { marketId: { not: null } },
      _count: { marketId: true },
      orderBy: { _count: { marketId: 'desc' } },
      take: 20,
    });

    const markets = await this.prisma.market.findMany({
      where: { id: { in: rows.map((r) => r.marketId!) } },
      select: { id: true, name: true },
    });

    return rows.map((r) => ({
      name: markets.find((m) => m.id === r.marketId)?.name || 'Unknown',
      count: r._count.marketId || 0,
    }));
  }
}
