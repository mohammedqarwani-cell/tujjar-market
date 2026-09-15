import { Module } from '@nestjs/common';
import { AdminVerificationController, MerchantVerificationController } from './verification.controller';
import { KycStorageService } from './kyc-storage.service';
import { VerificationService } from './verification.service';

@Module({
  controllers: [MerchantVerificationController, AdminVerificationController],
  providers: [VerificationService, KycStorageService],
  exports: [VerificationService],
})
export class VerificationModule {}
