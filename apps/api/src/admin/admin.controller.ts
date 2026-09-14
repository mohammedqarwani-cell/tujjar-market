import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Auth } from '../auth/guards';
import { AdminService } from './admin.service';

class UpdateStoreAdminDto {
  @IsOptional() @IsBoolean() isVerified?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
}

class UpdateProductAdminDto {
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsIn(['ACTIVE', 'HIDDEN', 'UNDER_REVIEW']) status?: 'ACTIVE' | 'HIDDEN' | 'UNDER_REVIEW';
}

class UpdateReportDto {
  @IsIn(['OPEN', 'RESOLVED', 'DISMISSED']) status!: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

@Controller('admin')
@Auth('ADMIN')
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

  @Patch('stores/:id')
  updateStore(@Param('id') id: string, @Body() dto: UpdateStoreAdminDto) {
    return this.admin.updateStore(id, dto);
  }

  @Get('products')
  products(@Query() query: Record<string, string>) {
    return this.admin.products(query);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductAdminDto) {
    return this.admin.updateProduct(id, dto);
  }

  @Get('reports')
  reports(@Query() query: Record<string, string>) {
    return this.admin.reports(query);
  }

  @Patch('reports/:id')
  updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.admin.updateReport(id, dto.status);
  }
}
