import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  async getRegions() {
    return this.prisma.region.findMany({
      include: { cities: { include: { markets: true } } },
    });
  }

  async getMarketsByCity(city: string) {
    const c = await this.prisma.city.findFirst({
      where: { name: city },
      include: { markets: true },
    });
    return c?.markets ?? [];
  }
}
