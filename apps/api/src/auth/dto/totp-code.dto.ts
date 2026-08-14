import { IsString, Length } from 'class-validator';

export class TotpCodeDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}
