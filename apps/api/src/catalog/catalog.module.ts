import { Module } from '@nestjs/common';
// import { PrismaService } from '../prisma.service';

import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { MetaModule } from './meta/meta.module';

@Module({
  imports: [StoresModule, ProductsModule, MediaModule, MetaModule],
//   providers: [PrismaService],
  exports: [StoresModule, ProductsModule, MediaModule, MetaModule],
})
export class CatalogModule {}
