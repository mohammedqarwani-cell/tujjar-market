// apps/api/src/catalog/regions/regions.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type CityWithRegion = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  region: { id: string; name: string; code: string; country: string };
};

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async resolveByGeo(lat: number, lng: number) {
    // اجلب المدن التي لديها إحداثيات
    const cities = await this.prisma.city.findMany({
      where: {
        AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
      },
      include: { region: true },
    });

    if (!cities.length) return null;

    // احسب الأقرب
    let best: { c: CityWithRegion; dist: number } | null = null;
    for (const c of cities as CityWithRegion[]) {
      const dist = this.haversineKm(lat, lng, c.latitude!, c.longitude!);
      if (!best || dist < best.dist) best = { c, dist };
    }

    // اعتبر أقرب مدينة ضمن 150كم (يمكن تعديل العتبة)
    if (!best || best.dist > 150) return null;

    return {
      region: {
        id: best.c.region.id,
        name: best.c.region.name,
        code: best.c.region.code,
        country: best.c.region.country,
      },
      city: {
        id: best.c.id,
        name: best.c.name,
      },
      distanceKm: Math.round(best.dist),
    };
  }
}
