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

export class UpsertRoutingRuleDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(80)
  subcategory?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Priority)
  severity?: Priority | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(80)
  zone?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  isEmergency?: boolean | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  institutionId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(8760)
  slaHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Priority)
  defaultPriority?: Priority | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
