import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Honeypot — must stay empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
