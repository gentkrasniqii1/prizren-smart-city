import { describe, expect, it } from 'vitest';
import {
  AI_CATEGORY_TO_DB_NAME,
  AI_CONFIDENCE_THRESHOLD,
  AI_SEVERITY_TO_PRIORITY,
  AIClassificationSchema,
  parseAIClassification,
} from './ai-classification.schema';

describe('AIClassificationSchema', () => {
  const valid = {
    category: 'waste' as const,
    severity: 'high' as const,
    confidence: 0.82,
    summary: 'Pile of trash near fountain',
    recommendedDepartment: 'Mbeturina',
  };

  it('accepts a valid classification payload', () => {
    const parsed = AIClassificationSchema.parse(valid);
    expect(parsed.category).toBe('waste');
    expect(parsed.confidence).toBe(0.82);
  });

  it('rejects confidence outside 0–1', () => {
    expect(() => AIClassificationSchema.parse({ ...valid, confidence: 1.2 })).toThrow();
    expect(() => AIClassificationSchema.parse({ ...valid, confidence: -0.1 })).toThrow();
  });

  it('rejects unknown category or severity', () => {
    expect(() => AIClassificationSchema.parse({ ...valid, category: 'pothole' })).toThrow();
    expect(() => AIClassificationSchema.parse({ ...valid, severity: 'extreme' })).toThrow();
  });

  it('rejects empty summary', () => {
    expect(() => AIClassificationSchema.parse({ ...valid, summary: '' })).toThrow();
  });
});

describe('parseAIClassification', () => {
  it('returns typed data for valid payloads', () => {
    const result = parseAIClassification({
      category: 'lighting',
      severity: 'low',
      confidence: 0.4,
      summary: 'Broken street light',
      recommendedDepartment: 'Ndriçim',
    });
    expect(result?.category).toBe('lighting');
    expect(result?.confidence).toBe(0.4);
  });

  it('returns null for invalid payloads instead of throwing', () => {
    expect(parseAIClassification(null)).toBeNull();
    expect(parseAIClassification({ category: 'waste' })).toBeNull();
    expect(parseAIClassification('nope')).toBeNull();
  });
});

describe('AI mapping helpers', () => {
  it('exposes review threshold at 0.6', () => {
    expect(AI_CONFIDENCE_THRESHOLD).toBe(0.6);
  });

  it('maps categories and severities to DB / priority values', () => {
    expect(AI_CATEGORY_TO_DB_NAME.road_damage).toBe('Grope / dëmtim rruge');
    expect(AI_SEVERITY_TO_PRIORITY.critical).toBe('CRITICAL');
    expect(AI_SEVERITY_TO_PRIORITY.medium).toBe('MEDIUM');
  });
});
