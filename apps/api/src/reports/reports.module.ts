import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '../common/throttle';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import { NotificationsService } from '../notifications/notifications.service';
import { damascusDay } from '../common/pagination';

export const REPORT_REASONS = ['احتيال أو نصب', 'منتج ممنوع', 'معلومات مضللة', 'رقم تواصل لا يعمل', 'أخرى'];
const MAX_REPORTS_PER_DAY = 10;

class CreateReportDto {
  @IsOptional() @IsString() storeSlug?: string;
  @IsOptional() @IsString() productId?: string;
  @IsIn(REPORT_REASONS, { message: 'اختر سبب البلاغ' }) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) details?: string;
}

@Injectable()
class ReportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto, ip: string) {
    let storeId: string;
    let productId: string | null = null;
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId }, select: { id: true, storeId: true } });
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

    const reporter = await this.prisma.user.findUnique({ where: { id: reporterId }, select: { reportingBlockedUntil: true } });
    if (reporter?.reportingBlockedUntil && reporter.reportingBlockedUntil > new Date()) {
      throw new HttpException('أُوقفت إمكانية الإبلاغ من حسابك مؤقتاً لكثرة البلاغات غير الصحيحة', HttpStatus.FORBIDDEN);
    }

    const [duplicate, today] = await Promise.all([
      this.prisma.report.findFirst({ where: { reporterId, status: 'OPEN', storeId, productId }, select: { id: true } }),
      this.prisma.report.count({ where: { reporterId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
    ]);
    if (duplicate) throw new ConflictException('سبق أن أبلغت عن هذا، وبلاغك قيد المراجعة');
    if (today >= MAX_REPORTS_PER_DAY) {
      throw new HttpException('وصلت للحد اليومي من البلاغات', HttpStatus.TOO_MANY_REQUESTS);
    }

    const report = await this.prisma.report.create({
      data: { reporterId, storeId, productId, reason: dto.reason, details: dto.details?.trim() || null },
    });
    await this.audit.log({ actorId: reporterId, action: 'report.create', entityType: 'report', entityId: report.id, ip });
    this.notifications.notifyStaff({
      category: 'MODERATION',
      type: 'report.created',
      title: 'بلاغ جديد',
      body: dto.reason,
      url: '/admin?tab=reports',
      groupKey: `queue-reports:${damascusDay().toISOString().slice(0, 10)}`,
      grouped: (count) => ({ title: 'بلاغات جديدة', body: `${count} بلاغات جديدة اليوم` }),
    });
  }
}

@Controller('reports')
class ReportsController {
  constructor(private reports: ReportsService) {}

  /** Reports require a verified buyer account, so moderators know who reported. */
  @Post()
  @HttpCode(204)
  @Auth('BUYER')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto, @Req() req: Request) {
    await this.reports.create(user.id, dto, clientIp(req));
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
