import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
