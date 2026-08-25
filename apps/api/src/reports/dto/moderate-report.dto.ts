import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MODERATION_ACTIONS, type ModerationAction } from '@prizren/shared-types';

export class ModerateReportDto {
  @IsIn([...MODERATION_ACTIONS])
  action!: ModerationAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID()
  duplicateOfId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;
}
