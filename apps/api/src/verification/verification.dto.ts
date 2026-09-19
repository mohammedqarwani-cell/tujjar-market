import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { VerificationLevel } from '@prisma/client';
import { LEVELS } from './verification.levels';

const GPS_REQUIRED = 'فعّل تحديد الموقع ثم أعد تصوير الفيديو';

/** Multipart text fields sent with the shop video. */
export class LocationEvidenceDto {
  @Type(() => Number)
  @IsNumber({}, { message: GPS_REQUIRED })
  @Min(-90)
  @Max(90)
  latitude!: number;
  @Type(() => Number)
  @IsNumber({}, { message: GPS_REQUIRED })
  @Min(-180)
  @Max(180)
  longitude!: number;
  /** Reported GPS accuracy radius in metres */
  @Type(() => Number)
  @IsNumber({}, { message: GPS_REQUIRED })
  @Min(0)
  @Max(100_000)
  accuracy!: number;
  @IsISO8601(
    { strict: true },
    { message: 'وقت التصوير غير معروف، أعد تصوير الفيديو' },
  )
  capturedAt!: string;
}

export class DecisionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

const NOTE_MESSAGE = 'اكتب ملاحظة توضح سبب التغيير (5 أحرف على الأقل)';

export class StoreLevelDto {
  @IsIn(LEVELS) level!: VerificationLevel;
  @IsString() @Length(5, 300, { message: NOTE_MESSAGE }) note!: string;
}

export class RestoreBadgeDto {
  @IsString() @Length(5, 300, { message: NOTE_MESSAGE }) note!: string;
}
