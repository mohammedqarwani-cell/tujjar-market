import { Module } from '@nestjs/common';
import { MerchantStatsController, TrackController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [TrackController, MerchantStatsController],
  providers: [StatsService],
})
export class StatsModule {}
