import { z } from 'zod';
import type { AIClassification } from '@prizren/shared-types';

/** Claude JSON only. HTTP bodies use shared Zod schemas plus class-validator DTOs. */

export const AI_CONFIDENCE_THRESHOLD = 0.6;

export const AIClassificationSchema = z.object({
  category: z.enum(['road_damage', 'lighting', 'waste', 'water', 'public_space', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(300),
  recommendedDepartment: z.string().min(1).max(120),
});

export type ParsedAIClassification = z.infer<typeof AIClassificationSchema>;

export function parseAIClassification(raw: unknown): AIClassification | null {
  const result = AIClassificationSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const AI_CATEGORY_TO_DB_NAME: Record<ParsedAIClassification['category'], string> = {
  road_damage: 'Grope / dëmtim rruge',
  lighting: 'Ndriçim publik i prishur',
  waste: 'Grumbullim mbeturinash / konteiner',
  water: 'Ujë i pijshëm (ndërprerje / cilësi)',
  public_space: 'Parke, pemë, hapësirë e gjelbër',
  other: 'Tjetër / e paklasifikuar',
};

export const AI_SEVERITY_TO_PRIORITY: Record<
  ParsedAIClassification['severity'],
  'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};
