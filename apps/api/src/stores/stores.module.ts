import { Module } from '@nestjs/common';
import { StoresController, MerchantStoreController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  controllers: [StoresController, MerchantStoreController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
