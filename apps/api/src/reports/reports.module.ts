import { Body, Controller, HttpCode, Injectable, Module, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

export const REPORT_REASONS = ['احتيال أو نصب', 'منتج ممنوع', 'معلومات مضللة', 'رقم تواصل لا يعمل', 'أخرى'];

class CreateReportDto {
  @IsOptional() @IsString() storeSlug?: string;
  @IsOptional() @IsString() productId?: string;
  @IsIn(REPORT_REASONS) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) details?: string;
}

@Injectable()
class ReportsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReportDto) {
    let storeId: string | undefined;
    let productId: string | undefined;
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, storeId: true },
      });
      if (!product) throw new NotFoundException('المنتج غير موجود');
      productId = product.id;
      storeId = product.storeId;
    } else if (dto.storeSlug) {
      const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug }, select: { id: true } });
      if (!store) throw new NotFoundException('المتجر غير موجود');
      storeId = store.id;
    } else {
      throw new NotFoundException('حدد المتجر أو المنتج');
    }
    await this.prisma.report.create({
      data: { storeId, productId, reason: dto.reason, details: dto.details?.trim() || null },
    });
  }
}

@Controller('reports')
@UseGuards(RateLimitGuard)
class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post()
  @HttpCode(204)
  @RateLimit(5, 60 * 60)
  async create(@Body() dto: CreateReportDto) {
    await this.reports.create(dto);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
