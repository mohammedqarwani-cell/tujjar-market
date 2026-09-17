import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController, AdminUsersService, PlatformStatsService } from './users-stats';

@Module({
  imports: [VerificationModule, ReviewsModule],
  controllers: [AdminController, AdminUsersController],
  providers: [AdminService, AdminUsersService, PlatformStatsService],
})
export class AdminModule {}
