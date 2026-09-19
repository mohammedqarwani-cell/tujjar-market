import { Module } from '@nestjs/common';
import {
  AdminReviewsController,
  MerchantReviewsController,
  StoreReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [
    StoreReviewsController,
    MerchantReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
