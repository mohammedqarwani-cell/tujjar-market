import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import { AdminService } from './admin.service';

class VerifyStoreDto {
  @IsBoolean() isVerified!: boolean;
}

class StoreStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status!: 'ACTIVE' | 'SUSPENDED';
}

class UpdateProductAdminDto {
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'HIDDEN', 'UNDER_REVIEW']) status?: 'ACTIVE' | 'HIDDEN' | 'UNDER_REVIEW';
}

class UpdateReportDto {
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED']) status!: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

@Controller('admin')
@Auth('ADMIN', 'MODERATOR')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('stores')
  stores(@Query() query: Record<string, string>) {
    return this.admin.stores(query);
  }

  @Patch('stores/:id/verification')
  verifyStore(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: VerifyStoreDto, @Req() req: Request) {
    return this.admin.verifyStore(actor.id, id, dto.isVerified, clientIp(req));
  }

  /** Suspending a store hides it and all its products, so only full admins may do it. */
  @Patch('stores/:id/status')
  @Auth('ADMIN')
  setStoreStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: StoreStatusDto, @Req() req: Request) {
    return this.admin.setStoreStatus(actor.id, id, dto.status, clientIp(req));
  }

  @Get('products')
  products(@Query() query: Record<string, string>) {
    return this.admin.products(query);
  }

  @Patch('products/:id')
  updateProduct(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductAdminDto, @Req() req: Request) {
    return this.admin.updateProduct(actor.id, id, dto, clientIp(req));
  }

  @Get('reports')
  reports(@Query() query: Record<string, string>) {
    return this.admin.reports(query);
  }

  @Patch('reports/:id')
  updateReport(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateReportDto, @Req() req: Request) {
    return this.admin.updateReport(actor.id, id, dto.status, clientIp(req));
  }

  @Get('audit-logs')
  @Auth('ADMIN')
  auditLogs(@Query() query: Record<string, string>) {
    return this.admin.auditLogs(query);
  }
}
