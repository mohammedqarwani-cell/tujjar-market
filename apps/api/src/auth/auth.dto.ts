import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString() phone!: string;
  @IsString() @MinLength(6, { message: 'كلمة المرور 6 أحرف على الأقل' }) password!: string;
}

export class RegisterDto {
  @IsString() @Length(2, 60, { message: 'الاسم بين 2 و60 حرفاً' }) name!: string;
  @IsString() phone!: string;
  @IsString() @MinLength(6, { message: 'كلمة المرور 6 أحرف على الأقل' }) password!: string;

  @IsString() @Length(2, 60, { message: 'اسم المتجر بين 2 و60 حرفاً' }) storeName!: string;
  @IsString() governorateId!: string;
  @IsOptional() @IsString() marketId?: string;
  @IsString() categoryId!: string;
  /** Defaults to the login phone when omitted */
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(120) address?: string;
}
