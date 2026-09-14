import { IsInt, IsOptional, IsString, Min, IsUrl, Matches } from 'class-validator';

export class CreateProductDto {
  // كنا نستخدم @IsUUID() — هذا خطأ لأن الـid من نوع CUID
  @IsString()
  // (اختياري) تحقق بسيط على صيغة الـcuid: يبدأ بـ c ويتبعه حروف/أرقام
  @Matches(/^c[0-9a-z]+$/i, { message: 'storeId must be a CUID (starts with "c")' })
  storeId!: string;

  @IsString() name!: string;
  @IsString() category!: string;

  @IsInt() @Min(1)
  price!: number;

  // اسمح بروابط localhost (بدون TLD)
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}
