import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { ActivityNotifier } from './activity';
import { CampaignsController, CampaignsService } from './campaigns';

/** Global so any feature can announce events with one call. */
@Global()
@Module({
  controllers: [NotificationsController, CampaignsController],
  providers: [
    NotificationsService,
    PushService,
    ActivityNotifier,
    CampaignsService,
  ],
  exports: [NotificationsService, ActivityNotifier],
})
export class NotificationsModule {}
