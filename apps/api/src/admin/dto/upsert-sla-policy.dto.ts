import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class UpsertSlaPolicyDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsEnum(Priority)
  priority!: Priority;

  @IsInt()
  @Min(1)
  @Max(525_600)
  responseTime!: number;

  @IsInt()
  @Min(1)
  @Max(525_600)
  resolutionTime!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
