import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MetaController } from './meta.controller';

@Module({
  controllers: [MetaController],
  providers: [PrismaService],
})
export class MetaModule {}
