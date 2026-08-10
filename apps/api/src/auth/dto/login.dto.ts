import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Honeypot — must stay empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
