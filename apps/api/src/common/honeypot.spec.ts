import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { rejectIfHoneypotFilled } from './honeypot';

describe('rejectIfHoneypotFilled', () => {
  it('allows empty, undefined, and whitespace-only values', () => {
    expect(() => rejectIfHoneypotFilled(undefined)).not.toThrow();
    expect(() => rejectIfHoneypotFilled('')).not.toThrow();
    expect(() => rejectIfHoneypotFilled('   ')).not.toThrow();
    expect(() => rejectIfHoneypotFilled(null)).not.toThrow();
  });

  it('rejects filled honeypot strings', () => {
    expect(() => rejectIfHoneypotFilled('http://spam.example')).toThrow(BadRequestException);
    expect(() => rejectIfHoneypotFilled('x')).toThrow(BadRequestException);
  });
});
