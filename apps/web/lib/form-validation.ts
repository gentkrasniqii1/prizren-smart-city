import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, HONEYPOT_MAX } from '@prizren/shared-types';

export { zodResolver };

type Translate = {
  (key: string): string;
  has: (key: string) => boolean;
};

export function issueMessage(
  error: FieldError | undefined,
  ...translators: Translate[]
): string | undefined {
  const raw = error?.message;
  if (!raw) return undefined;
  for (const t of translators) {
    if (t.has(raw)) return t(raw);
  }
  return raw;
}

export const createReportFormSchema = z.object({
  description: z.string().trim().min(DESCRIPTION_MIN, 'descriptionError').max(DESCRIPTION_MAX),
  photo: z.custom<File | null>((value) => value instanceof File, { message: 'photoRequired' }),
  lat: z.number({ error: 'locationRequired' }).gte(-90).lte(90),
  lng: z.number({ error: 'locationRequired' }).gte(-180).lte(180),
  address: z.string().optional(),
  categoryId: z.string().optional(),
  website: z.string().max(HONEYPOT_MAX).optional(),
});

export type CreateReportFormValues = z.input<typeof createReportFormSchema>;
