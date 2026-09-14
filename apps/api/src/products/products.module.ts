import { Module } from '@nestjs/common';
import { MerchantProductsController, ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, MerchantProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
