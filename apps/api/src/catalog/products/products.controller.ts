import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../identity/auth/jwt.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { NotFoundException } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // المنتجات العامة (تبقى كما لديك)
  @Get()
  publicProducts(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('market') market?: string,
    @Query('storeSlug') storeSlug?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.productsService.findAll({
      q,
      category,
      city,
      market,
      storeSlug,
      page: Number(page),
      pageSize: Math.min(Number(pageSize), 50),
      statusScope: 'PUBLIC',
    });
  }

  // منتجاتي (للتاجر المسجّل)
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  myProducts(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.productsService.findAll({
      page: Number(page),
      pageSize: Math.min(Number(pageSize), 50),
      statusScope: 'MINE',
      userId: req.user.sub,
      userRole: req.user.role,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() body: CreateProductDto) {
    return this.productsService.createForOwner(req.user.sub, body);
  }

  // تحديث منتج يملكه المستخدم
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateMine(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      price: number;
      category: string;
      imageUrl?: string;
    }>,
  ) {
    return this.productsService.updateForOwner(req.user.sub, id, body);
  }

  // حذف منتج يملكه المستخدم
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteMine(@Req() req: any, @Param('id') id: string) {
    return this.productsService.deleteForOwner(req.user.sub, id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const p = await this.productsService.findOne(id);
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/visibility')
  toggleVisibility(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'HIDDEN' },
  ) {
    return this.productsService.setVisibilityForOwner(
      req.user.sub,
      id,
      body.status,
    );
  }

  @Get('featured')
  featured(@Query('page') page = '1', @Query('pageSize') pageSize = '12') {
    return this.productsService.findFeatured({
      page: Number(page),
      pageSize: Math.min(Number(pageSize), 50),
    });
  }
}
