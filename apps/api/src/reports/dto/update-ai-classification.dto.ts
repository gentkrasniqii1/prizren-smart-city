import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAiClassificationDto {
  @IsIn(['accept', 'edit'])
  action!: 'accept' | 'edit';

  @IsOptional()
  @IsIn(['road_damage', 'lighting', 'waste', 'water', 'public_space', 'other'])
  category?: 'road_damage' | 'lighting' | 'waste' | 'water' | 'public_space' | 'other';

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recommendedDepartment?: string;
}
