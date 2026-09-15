import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { env } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { decrypt, encrypt } from '../common/crypto';
import type { Audience, RequestMeta } from '../common/request';
import { buildSearchText } from '../common/text/arabic';
import { normalizeSyrianMobile } from '../common/text/phone';
import { slugify, withSuffix } from '../common/text/slug';
import { LoginDto, RegisterBuyerDto, RegisterMerchantDto, ResetPasswordDto } from './auth.dto';
import { OtpService } from './otp.service';
import { ROLE_AUDIENCE } from './roles';
import { SessionService } from './session.service';
import { base32Decode, base32Encode, matchTotp, otpauthUrl } from './totp';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;
const BCRYPT_ROUNDS = 12;
// Compared against when the phone doesn't exist, so response time doesn't reveal it
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private sessions: SessionService,
    private otp: OtpService,
    private audit: AuditService,
  ) {}

  private phoneOrThrow(raw: string) {
    const phone = normalizeSyrianMobile(raw);
    if (!phone) throw new BadRequestException('رقم الموبايل غير صحيح، مثال: 0912345678');
    return phone;
  }

  private async assertPhoneFree(phone: string) {
    if (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } })) {
      throw new ConflictException('هذا الرقم مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك');
    }
  }

  async registerBuyer(dto: RegisterBuyerDto, meta: RequestMeta) {
    const phone = this.phoneOrThrow(dto.phone);
    await this.assertPhoneFree(phone);
    await this.otp.verify(phone, 'REGISTER', dto.otpCode);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: 'BUYER',
        phoneVerifiedAt: new Date(),
        termsVersion: env.termsVersion,
        termsAcceptedAt: new Date(),
      },
    });
    await this.audit.log({ actorId: user.id, action: 'user.register', entityType: 'user', entityId: user.id, ip: meta.ip });
    return this.startSession(user, 'web', meta, false);
  }

  async registerMerchant(dto: RegisterMerchantDto, meta: RequestMeta) {
    const phone = this.phoneOrThrow(dto.phone);
    const whatsapp = dto.whatsapp ? normalizeSyrianMobile(dto.whatsapp) : phone;
    if (!whatsapp) throw new BadRequestException('رقم الواتساب غير صحيح');
    await this.assertPhoneFree(phone);

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

    await this.otp.verify(phone, 'REGISTER', dto.otpCode);

    let slug = slugify(dto.storeName);
    if (await this.prisma.store.findUnique({ where: { slug } })) slug = withSuffix(slug);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: 'MERCHANT',
        phoneVerifiedAt: new Date(),
        termsVersion: env.termsVersion,
        termsAcceptedAt: new Date(),
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
            attestedAt: new Date(),
            searchText: buildSearchText(dto.storeName, market?.name, governorate.name, category.name),
          },
        },
      },
    });
    await this.audit.log({ actorId: user.id, action: 'merchant.register', entityType: 'user', entityId: user.id, ip: meta.ip });
    return this.startSession(user, 'merchant', meta, false);
  }

  async login(dto: LoginDto, aud: Audience, meta: RequestMeta) {
    const invalid = () => new UnauthorizedException('رقم الموبايل أو كلمة المرور غير صحيحة');
    const phone = normalizeSyrianMobile(dto.phone);
    const user = phone ? await this.prisma.user.findUnique({ where: { phone } }) : null;
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw invalid();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('الحساب مقفل مؤقتاً بسبب محاولات فاشلة متكررة، حاول بعد 15 دقيقة', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: lock ? 0 : failed, ...(lock ? { lockedUntil: new Date(Date.now() + LOCK_MS) } : {}) },
      });
      await this.audit.log({
        actorId: user.id,
        action: lock ? 'auth.account_locked' : 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        meta: { aud },
        ip: meta.ip,
      });
      throw invalid();
    }

    // A buyer account can't open the merchant or admin interface, and vice versa
    if (!ROLE_AUDIENCE[aud].includes(user.role)) throw invalid();
    if (user.status !== 'ACTIVE') throw new ForbiddenException('الحساب موقوف، تواصل مع إدارة المنصة');

    let mfa = false;
    if (aud === 'admin' && user.totpEnabled) {
      if (!dto.totp) {
        throw new UnauthorizedException({ statusCode: 401, message: 'أدخل رمز المصادقة الثنائية', code: 'TOTP_REQUIRED' });
      }
      if (!(await this.consumeTotp(user, dto.totp))) {
        await this.audit.log({ actorId: user.id, action: 'auth.totp_failed', entityType: 'user', entityId: user.id, ip: meta.ip });
        throw new UnauthorizedException({ statusCode: 401, message: 'رمز المصادقة غير صحيح', code: 'TOTP_INVALID' });
      }
      mfa = true;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, meta: { aud, mfa }, ip: meta.ip });
    return this.startSession(user, aud, meta, mfa);
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta) {
    const phone = this.phoneOrThrow(dto.phone);
    await this.otp.verify(phone, 'RESET_PASSWORD', dto.otpCode);
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) throw new BadRequestException('رمز التحقق غير صحيح');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS), failedLogins: 0, lockedUntil: null },
    });
    await this.sessions.revokeAllForUser(user.id);
    await this.audit.log({ actorId: user.id, action: 'auth.password_reset', entityType: 'user', entityId: user.id, ip: meta.ip });
  }

  async me(userId: string, aud: Audience, mfa: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        totpEnabled: true,
        stores: aud === 'merchant' ? { select: { id: true, slug: true, name: true, status: true }, take: 1 } : false,
      },
    });
    if (!user) throw new UnauthorizedException('سجّل الدخول للمتابعة');
    const { stores, totpEnabled, ...rest } = user;
    return {
      ...rest,
      store: stores?.[0] ?? null,
      mfa,
      mustSetupTotp: aud === 'admin' && !totpEnabled,
    };
  }

  // ---------- admin two-factor ----------

  async totpSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new BadRequestException('المصادقة الثنائية مفعّلة مسبقاً');
    const secret = base32Encode(randomBytes(20));
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(env.totpKey, secret) } });
    return { secret, otpauthUrl: otpauthUrl(secret, `0${user.phone.slice(3)}`) };
  }

  async totpEnable(userId: string, code: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new BadRequestException('المصادقة الثنائية مفعّلة مسبقاً');
    if (!user.totpSecret) throw new BadRequestException('ابدأ إعداد المصادقة الثنائية أولاً');
    if (!(await this.consumeTotp(user, code))) throw new BadRequestException('رمز المصادقة غير صحيح');

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.sessions.revokeAllForUser(userId);
    await this.audit.log({ actorId: userId, action: 'auth.totp_enabled', entityType: 'user', entityId: userId, ip: meta.ip });
    return this.startSession({ ...user, totpEnabled: true }, 'admin', meta, true);
  }

  /** Verifies a TOTP code and records its time step so the same code can't be replayed. */
  private async consumeTotp(user: User, code: string): Promise<boolean> {
    if (!user.totpSecret) return false;
    const step = matchTotp(base32Decode(decrypt(env.totpKey, user.totpSecret)), code);
    if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) return false;
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return count === 1;
  }

  private async startSession(user: User, aud: Audience, meta: RequestMeta, mfa: boolean) {
    const tokens = await this.sessions.issue(user, aud, meta, { mfa });
    return { tokens, user: await this.me(user.id, aud, mfa) };
  }
}
