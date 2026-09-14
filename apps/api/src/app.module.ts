import { Module } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';
import { CatalogModule } from './catalog/catalog.module';
import { RegionsController } from './meta/meta.controller';

@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [RegionsController],
})
export class AppModule {}
