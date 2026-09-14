import { Controller, Get, Query } from '@nestjs/common';
import { RegionsService } from './regions.service';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  getAll() {
    return this.regionsService.getRegions();
  }

  @Get('markets')
  getMarkets(@Query('city') city: string) {
    return this.regionsService.getMarketsByCity(city);
  }
}
