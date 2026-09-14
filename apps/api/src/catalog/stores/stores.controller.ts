import { Controller, Get, Param, Query } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // GET /stores?city=Damascus&market=Al-Hamidiyah&limit=20&hasImageOnly=true
  @Get()
  findAll(
    @Query('city') city?: string,
    @Query('market') market?: string,
    @Query('limit') limit = '50',
    @Query('hasImageOnly') hasImageOnly?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    const imgOnly = hasImageOnly === 'true';

    return this.storesService.findAll({
      city: city?.trim() || undefined,
      market: market?.trim() || undefined,
      limit: take,
      hasImageOnly: imgOnly,
    });
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }
}
