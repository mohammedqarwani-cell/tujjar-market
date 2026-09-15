import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { SmsModule } from './sms/sms.module';
import { AuthModule } from './auth/auth.module';
import { DirectoryModule } from './directory/directory.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { StatsModule } from './stats/stats.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { CsrfGuard } from './common/csrf.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'محاولات كثيرة، حاول لاحقاً',
    }),
    PrismaModule,
    AuditModule,
    SmsModule,
    AuthModule,
    DirectoryModule,
    StoresModule,
    ProductsModule,
    MediaModule,
    StatsModule,
    ReportsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
