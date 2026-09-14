import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DirectoryModule } from './directory/directory.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { StatsModule } from './stats/stats.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DirectoryModule,
    StoresModule,
    ProductsModule,
    MediaModule,
    StatsModule,
    ReportsModule,
    AdminModule,
  ],
})
export class AppModule {}
