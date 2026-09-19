import { Currency, ItemCondition, PriceType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_PRICE = 2_000_000_000;

export class ProductInputDto {
  @IsString()
  @Length(2, 120, { message: 'اسم المنتج بين 2 و120 حرفاً' })
  title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() categoryId!: string;
  @IsEnum(PriceType) priceType!: PriceType;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_PRICE) price?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_PRICE) oldPrice?: number | null;
  @IsEnum(Currency) currency!: Currency;
  @IsEnum(ItemCondition) condition!: ItemCondition;
  @IsBoolean() inStock!: boolean;
  @IsArray()
  @ArrayMaxSize(6, { message: '6 صور كحد أقصى' })
  @IsUrl({ require_tld: false }, { each: true })
  images!: string[];
}

export class ProductStatusDto {
  @IsIn(['ACTIVE', 'HIDDEN']) status!: 'ACTIVE' | 'HIDDEN';
}
