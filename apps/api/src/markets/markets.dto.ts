import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'الرابط المختصر أحرف إنجليزية صغيرة وأرقام وشرطات فقط';
const MARKET_NAME = 'اسم السوق بين 2 و60 حرفاً';
const CATEGORY_NAME = 'اسم القسم بين 2 و40 حرفاً';
const RADIUS = 'نصف قطر السوق بين 50 و3000 متر';

export class GovernorateStatusDto {
  @IsIn(['ACTIVE', 'COMING_SOON']) status!: 'ACTIVE' | 'COMING_SOON';
}

export class CreateMarketDto {
  @IsString() governorateId!: string;
  @IsString() @Length(2, 60, { message: MARKET_NAME }) name!: string;
  @IsOptional() @IsString() @Length(2, 48) @Matches(SLUG, { message: SLUG_MESSAGE }) slug?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class UpdateMarketDto {
  @IsOptional() @IsString() @Length(2, 60, { message: MARKET_NAME }) name?: string;
  @IsOptional() @IsString() @Length(2, 48) @Matches(SLUG, { message: SLUG_MESSAGE }) slug?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class GeofenceDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsInt({ message: RADIUS }) @Min(50, { message: RADIUS }) @Max(3000, { message: RADIUS }) radiusMeters!: number;
  /** DRAFT only guides reviewers; CONFIRMED (after a field survey) refuses videos recorded outside */
  @IsIn(['DRAFT', 'CONFIRMED']) status!: 'DRAFT' | 'CONFIRMED';
}

export class CreateCategoryDto {
  @IsString() @Length(2, 40, { message: CATEGORY_NAME }) name!: string;
  @IsString() @Length(1, 8, { message: 'اختر رمزاً (إيموجي) للقسم' }) icon!: string;
  @IsOptional() @IsString() @Length(2, 48) @Matches(SLUG, { message: SLUG_MESSAGE }) slug?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @Length(2, 40, { message: CATEGORY_NAME }) name?: string;
  @IsOptional() @IsString() @Length(1, 8, { message: 'اختر رمزاً (إيموجي) للقسم' }) icon?: string;
  @IsOptional() @IsString() @Length(2, 48) @Matches(SLUG, { message: SLUG_MESSAGE }) slug?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class InterestDto {
  @IsString() governorateId!: string;
  @IsString() @Length(2, 60, { message: 'الاسم بين 2 و60 حرفاً' }) name!: string;
  @IsString() phone!: string;
  @IsOptional() @IsString() @MaxLength(60) storeName?: string;
  @IsOptional() @IsString() categoryId?: string;
}

export class InterestContactedDto {
  @IsBoolean() contacted!: boolean;
}
