import { IsBoolean, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class UpdateStoreDto {
  @IsString() @Length(2, 60, { message: 'اسم المتجر بين 2 و60 حرفاً' }) name!: string;
  @IsOptional() @IsString() @MaxLength(90) tagline?: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
  @IsString() governorateId!: string;
  @IsOptional() @IsString() marketId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(160) address?: string;
  @IsOptional() @IsUrl({}, { message: 'رابط الخريطة غير صحيح' }) mapUrl?: string;
  @IsString() whatsapp!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @MaxLength(80) openingHours?: string;
  @IsOptional() @IsUrl({ require_tld: false }) logoUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) coverUrl?: string;
  @IsBoolean() hasDelivery!: boolean;
}
