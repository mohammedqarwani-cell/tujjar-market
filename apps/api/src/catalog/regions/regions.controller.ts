// apps/api/src/catalog/regions/regions.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { RegionsService } from './regions.service';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get('resolve')
  async resolve(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    if (!lat || !lng) throw new BadRequestException('lat,lng required');
    const la = Number(lat), ln = Number(lng);
    if (Number.isNaN(la) || Number.isNaN(ln)) {
      throw new BadRequestException('invalid lat,lng');
    }
    const r = await this.regions.resolveByGeo(la, ln);
    return r ?? { region: null, city: null };
  }
}
