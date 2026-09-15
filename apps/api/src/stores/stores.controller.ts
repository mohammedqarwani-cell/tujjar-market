import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { StoresService } from './stores.service';
import { UpdateStoreDto } from './store.dto';

@Controller('stores')
export class StoresController {
  constructor(private stores: StoresService) {}

  // GET /stores?q=&gov=&market=&category=&page=&pageSize=
  @Get()
  list(@Query() query: Record<string, string>) {
    return this.stores.list(query);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.stores.bySlug(slug);
  }
}

@Controller('merchant/store')
@Auth('MERCHANT')
export class MerchantStoreController {
  constructor(private stores: StoresService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.stores.ownedBy(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateStoreDto) {
    return this.stores.update(user.id, dto);
  }
}
