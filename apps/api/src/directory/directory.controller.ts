import { Controller, Get, Param, Query } from '@nestjs/common';
import { DirectoryService } from './directory.service';

@Controller()
export class DirectoryController {
  constructor(private directory: DirectoryService) {}

  /** Everything the homepage needs in one round trip (slow connections). */
  @Get('home')
  home(@Query('gov') gov?: string) {
    return this.directory.home(gov);
  }

  @Get('governorates')
  governorates() {
    return this.directory.governorates();
  }

  @Get('categories')
  categories() {
    return this.directory.categories();
  }

  @Get('markets/:slug')
  market(@Param('slug') slug: string) {
    return this.directory.market(slug);
  }
}
