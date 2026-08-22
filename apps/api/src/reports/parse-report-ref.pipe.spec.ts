import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseReportRefPipe } from './parse-report-ref.pipe';

describe('ParseReportRefPipe', () => {
  const pipe = new ParseReportRefPipe();

  it('accepts a UUID in any version nibble', () => {
    expect(pipe.transform('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('accepts and uppercases a publicId', () => {
    expect(pipe.transform('prz-2026-000184')).toBe('PRZ-2026-000184');
  });

  it('rejects garbage that is neither a UUID nor a publicId', () => {
    expect(() => pipe.transform('r1')).toThrow(BadRequestException);
    expect(() => pipe.transform('not-a-report')).toThrow(BadRequestException);
  });
});
