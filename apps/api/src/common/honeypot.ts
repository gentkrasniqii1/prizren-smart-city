import { BadRequestException } from '@nestjs/common';

/** Silent reject when bots fill the hidden honeypot field. */
export function rejectIfHoneypotFilled(value: unknown): void {
  if (typeof value === 'string' && value.trim().length > 0) {
    throw new BadRequestException('Invalid request');
  }
}
