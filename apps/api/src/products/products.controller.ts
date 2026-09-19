import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { ProductsService } from './products.service';
import { ProductInputDto, ProductStatusDto } from './product.dto';

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  // GET /products?q=&category=&gov=&market=&store=&condition=&currency=&sort=&page=&pageSize=
  @Get()
  list(@Query() query: Record<string, string>) {
    return this.products.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.detail(id);
  }
}

@Controller('merchant/products')
@Auth('MERCHANT')
export class MerchantProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.products.mine(user.id, query);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.ownedOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: ProductInputDto) {
    return this.products.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ProductInputDto,
  ) {
    return this.products.update(user.id, id, dto);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ProductStatusDto,
  ) {
    return this.products.setStatus(user.id, id, dto.status);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(user.id, id);
  }
}
