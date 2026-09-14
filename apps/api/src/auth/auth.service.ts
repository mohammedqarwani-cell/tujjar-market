import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { buildSearchText } from '../common/text/arabic';
import { normalizeSyrianMobile } from '../common/text/phone';
import { slugify, withSuffix } from '../common/text/slug';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const phone = normalizeSyrianMobile(dto.phone);
    if (!phone) throw new BadRequestException('رقم الموبايل غير صحيح، مثال: 0912345678');
    const whatsapp = dto.whatsapp ? normalizeSyrianMobile(dto.whatsapp) : phone;
    if (!whatsapp) throw new BadRequestException('رقم الواتساب غير صحيح');

    if (await this.prisma.user.findUnique({ where: { phone } })) {
      throw new ConflictException('هذا الرقم مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك');
    }

    const [governorate, market, category] = await Promise.all([
      this.prisma.governorate.findUnique({ where: { id: dto.governorateId } }),
      dto.marketId ? this.prisma.market.findUnique({ where: { id: dto.marketId } }) : null,
      this.prisma.category.findUnique({ where: { id: dto.categoryId } }),
    ]);
    if (!governorate) throw new BadRequestException('اختر المحافظة');
    if (!category) throw new BadRequestException('اختر تصنيف المتجر');
    if (dto.marketId && market?.governorateId !== governorate.id) {
      throw new BadRequestException('السوق لا يتبع المحافظة المختارة');
    }

    let slug = slugify(dto.storeName);
    if (await this.prisma.store.findUnique({ where: { slug } })) slug = withSuffix(slug);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: 'MERCHANT',
        stores: {
          create: {
            slug,
            name: dto.storeName.trim(),
            governorateId: governorate.id,
            marketId: market?.id,
            categoryId: category.id,
            whatsapp,
            phone,
            address: dto.address?.trim() || null,
            searchText: buildSearchText(dto.storeName, market?.name, governorate.name, category.name),
          },
        },
      },
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const phone = normalizeSyrianMobile(dto.phone);
    const user = phone ? await this.prisma.user.findUnique({ where: { phone } }) : null;
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('رقم الموبايل أو كلمة المرور غير صحيحة');
    }
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        stores: { select: { id: true, slug: true, name: true, status: true }, take: 1 },
      },
    });
    if (!user) throw new UnauthorizedException();
    const { stores, ...rest } = user;
    return { ...rest, store: stores[0] ?? null };
  }

  private async session(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user: await this.me(user.id) };
  }
}
