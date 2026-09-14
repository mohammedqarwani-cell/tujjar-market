import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { PrismaModule } from 'src/prisma.module';

@Module({
  imports: [PrismaModule], // 👈 ضروري
  providers: [StoresService],
  controllers: [StoresController],
})
export class StoresModule {}
