import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const RATING = 'اختر تقييماً من 1 إلى 5 نجوم';

export class ReviewInputDto {
  @IsInt({ message: RATING })
  @Min(1, { message: RATING })
  @Max(5, { message: RATING })
  rating!: number;
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'التعليق 500 حرف كحد أقصى' })
  comment?: string;
}

export class MerchantReplyDto {
  @IsString()
  @Length(2, 500, { message: 'الرد بين 2 و500 حرف' })
  reply!: string;
}

export class FlagReviewDto {
  @IsString()
  @Length(5, 300, { message: 'اكتب سبب طلب المراجعة (5 أحرف على الأقل)' })
  reason!: string;
}

export class ModerateReviewDto {
  @IsIn(['PUBLISHED', 'HIDDEN']) status!: 'PUBLISHED' | 'HIDDEN';
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
