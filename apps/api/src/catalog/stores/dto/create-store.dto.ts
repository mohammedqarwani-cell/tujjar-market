import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateStoreDto {
  @IsString() @MinLength(2) name!: string;

  // حروف/أرقام و - فقط (slug-url)
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() market?: string;
}
