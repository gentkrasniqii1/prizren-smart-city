import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteFacebookDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
