import { Module } from '@nestjs/common';
import {
  AdminPlacesController,
  InterestController,
} from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  controllers: [AdminPlacesController, InterestController],
  providers: [MarketsService],
})
export class MarketsModule {}
