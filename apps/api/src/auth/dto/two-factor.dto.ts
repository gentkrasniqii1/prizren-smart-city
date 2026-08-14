import { IsBoolean, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class TwoFactorLoginDto {
  @IsString()
  @MinLength(20)
  challengeToken!: string;

  @IsString()
  @Length(6, 8)
  code!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  trustDevice?: boolean;
}
