import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { VerificationModule } from './verification/verification.module';
import { MarketsModule } from './markets/markets.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { EngagementModule } from './engagement/engagement';
import { CsrfGuard } from './common/csrf.guard';
import { ThrottleGuard } from './common/throttle';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    SearchModule,
    SmsModule,
    AuthModule,
    DirectoryModule,
    StoresModule,
    ProductsModule,
    MediaModule,
    StatsModule,
    ReportsModule,
    VerificationModule,
    MarketsModule,
    ReviewsModule,
    AdminModule,
    EngagementModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
