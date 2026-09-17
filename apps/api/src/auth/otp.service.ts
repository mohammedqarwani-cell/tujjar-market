import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { OtpPurpose } from '@prisma/client';
import { randomInt } from 'crypto';
import { env } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { hmacSha256, safeEqual } from '../common/crypto';
import { normalizeSyrianMobile } from '../common/text/phone';
import { SmsSender } from '../sms/sms.module';

const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_GAP_MS = 60_000;
const MAX_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private sms: SmsSender,
  ) {}

  private hash(phone: string, purpose: OtpPurpose, code: string) {
    return hmacSha256(env.otpPepper, `${phone}:${purpose}:${code}`);
  }

  async request(rawPhone: string, purpose: OtpPurpose, ip: string) {
    const phone = normalizeSyrianMobile(rawPhone);
    if (!phone) throw new BadRequestException('رقم الموبايل غير صحيح، مثال: 0912345678');

    const exists = !!(await this.prisma.user.findUnique({ where: { phone }, select: { id: true } }));
    if (purpose === 'CHANGE_PHONE' && exists) {
      throw new ConflictException('هذا الرقم مستخدم في حساب آخر');
    }
    if (purpose === 'REGISTER' && exists) {
      throw new ConflictException('هذا الرقم مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك');
    }

    const now = Date.now();
    const [latest, lastHour] = await Promise.all([
      this.prisma.otpCode.findFirst({ where: { phone, purpose }, orderBy: { createdAt: 'desc' } }),
      this.prisma.otpCode.count({ where: { phone, createdAt: { gte: new Date(now - 3600_000) } } }),
    ]);
    if (latest && now - latest.createdAt.getTime() < RESEND_GAP_MS) {
      throw new HttpException('انتظر دقيقة قبل طلب رمز جديد', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (lastHour >= MAX_PER_HOUR) {
      throw new HttpException('طلبت رموزاً كثيرة، حاول بعد ساعة', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Password reset for an unknown number answers the same way, so numbers can't be probed
    if (purpose === 'RESET_PASSWORD' && !exists) return { sent: true };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { phone, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: { phone, purpose, codeHash: this.hash(phone, purpose, code), expiresAt: new Date(now + TTL_MS), ip },
      }),
    ]);
    await this.sms.send(phone, `رمز التحقق في تُجّار ماركت: ${code}\nلا تشاركه مع أحد. صالح 5 دقائق.`);

    return { sent: true, ...(env.otpDevEcho ? { devCode: code } : {}) };
  }

  /** Consumes the code on success; throws with an Arabic message otherwise. */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('رمز التحقق غير صحيح أو انتهت صلاحيته، اطلب رمزاً جديداً');

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
      throw new BadRequestException('تجاوزت عدد المحاولات، اطلب رمزاً جديداً');
    }
    if (!safeEqual(record.codeHash, this.hash(phone, purpose, code))) {
      await this.prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('رمز التحقق غير صحيح');
    }
    await this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  }
}
