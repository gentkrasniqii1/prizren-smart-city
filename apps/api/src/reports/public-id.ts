import { Prisma } from '@prisma/client';

/** Human-readable incident code shown to citizens/staff, e.g. "PRZ-2026-000184". */
export const REPORT_PUBLIC_ID_PATTERN = /^PRZ-\d{4}-\d{6,}$/i;

export function formatPublicId(year: number, sequence: number): string {
  return `PRZ-${year}-${String(sequence).padStart(6, '0')}`;
}

export function isReportPublicId(value: string): boolean {
  return REPORT_PUBLIC_ID_PATTERN.test(value.trim());
}

export function reportWhereByRef(ref: string): Prisma.ReportWhereUniqueInput {
  const value = ref.trim();
  return isReportPublicId(value) ? { publicId: value.toUpperCase() } : { id: value };
}

/**
 * Atomically allocates the next publicId for the given year using the generic
 * `SequenceCounter` table (row-level lock via upsert serializes concurrent
 * creators). Must be called inside the same transaction as the `Report`
 * insert so a failed report create doesn't burn a sequence number silently
 * out of order (a small gap is acceptable; duplicates are not).
 */
export async function nextReportPublicId(
  tx: Prisma.TransactionClient,
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const key = `report-${year}`;
  const counter = await tx.sequenceCounter.upsert({
    where: { id: key },
    create: { id: key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatPublicId(year, counter.value);
}
