import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListOutboundEmailQueryDto } from './list-outbound-email-query.dto';

describe('ListOutboundEmailQueryDto', () => {
  it('accepts an optional q within 200 characters', async () => {
    const dto = plainToInstance(ListOutboundEmailQueryDto, { q: 'KEDS', page: '1', limit: '20' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.q).toBe('KEDS');
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('rejects q longer than 200 characters (not silently truncated)', async () => {
    const dto = plainToInstance(ListOutboundEmailQueryDto, { q: 'x'.repeat(201) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });
});
