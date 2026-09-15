import { Equals, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-zء-ي])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'كلمة المرور 8 أحرف على الأقل وتحتوي حروفاً وأرقاماً';
const OTP_RULE = /^\d{6}$/;

export class RequestOtpDto {
  @IsString() phone!: string;
  @IsIn(['REGISTER', 'RESET_PASSWORD']) purpose!: 'REGISTER' | 'RESET_PASSWORD';
}

export class LoginDto {
  @IsString() phone!: string;
  @IsString() @Length(1, 72) password!: string;
  @IsOptional() @Matches(OTP_RULE, { message: 'رمز المصادقة 6 أرقام' }) totp?: string;
}

class RegisterBaseDto {
  @IsString() @Length(2, 60, { message: 'الاسم بين 2 و60 حرفاً' }) name!: string;
  @IsString() phone!: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password!: string;
  @Matches(OTP_RULE, { message: 'رمز التحقق 6 أرقام' }) otpCode!: string;
  @IsBoolean()
  @Equals(true, { message: 'يجب الموافقة على الشروط والأحكام وسياسة الخصوصية' })
  acceptTerms!: boolean;
}

export class RegisterBuyerDto extends RegisterBaseDto {}

export class RegisterMerchantDto extends RegisterBaseDto {
  @IsString() @Length(2, 60, { message: 'اسم المتجر بين 2 و60 حرفاً' }) storeName!: string;
  @IsString() governorateId!: string;
  @IsOptional() @IsString() marketId?: string;
  @IsString() categoryId!: string;
  /** Defaults to the verified login phone when omitted */
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) address?: string;
  /** Self-declaration required before opening a store (trader traceability, DSA Art. 30) */
  @IsBoolean()
  @Equals(true, { message: 'يجب التعهد بصحة معلومات المتجر ووجود المحل في السوق المختار' })
  attestTruth!: boolean;
}

export class ResetPasswordDto {
  @IsString() phone!: string;
  @Matches(OTP_RULE, { message: 'رمز التحقق 6 أرقام' }) otpCode!: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) newPassword!: string;
}

export class TotpCodeDto {
  @Matches(OTP_RULE, { message: 'رمز المصادقة 6 أرقام' }) code!: string;
}
