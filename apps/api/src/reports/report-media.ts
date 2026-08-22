import type { ReportMediaDto, ReportMediaRole, ReportMediaVisibility } from '@prizren/shared-types';

export type MediaRow = {
  id: string;
  role: ReportMediaRole | string;
  sortOrder: number;
  url: string;
  mimeType: string | null;
  visibility: ReportMediaVisibility | string;
  createdAt: Date | string;
};

export function toMediaDto(row: MediaRow): ReportMediaDto {
  return {
    id: row.id,
    role: row.role as ReportMediaRole,
    sortOrder: row.sortOrder,
    url: row.url,
    mimeType: row.mimeType,
    visibility: row.visibility as ReportMediaVisibility,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

/** Prefer relational rows; fall back to denormalized photoUrl/photoAfterUrl for older cases. */
export function resolveReportMedia(input: {
  media?: MediaRow[] | null;
  photoUrl: string | null;
  photoAfterUrl: string | null;
  staff: boolean;
}): ReportMediaDto[] {
  const rows = (input.media ?? []).slice().sort((a, b) => {
    if (a.role !== b.role) return String(a.role).localeCompare(String(b.role));
    return a.sortOrder - b.sortOrder;
  });
  const mapped = rows
    .filter((row) => input.staff || row.visibility === 'PUBLIC')
    .filter((row) => input.staff || row.role !== 'ATTACHMENT')
    .map(toMediaDto);
  if (mapped.length > 0) return mapped;

  const fallback: ReportMediaDto[] = [];
  if (input.photoUrl) {
    fallback.push({
      id: 'legacy-initial',
      role: 'INITIAL',
      sortOrder: 0,
      url: input.photoUrl,
      mimeType: null,
      visibility: 'PUBLIC',
      createdAt: new Date(0).toISOString(),
    });
  }
  if (input.photoAfterUrl) {
    fallback.push({
      id: 'legacy-after',
      role: 'AFTER',
      sortOrder: 0,
      url: input.photoAfterUrl,
      mimeType: null,
      visibility: 'PUBLIC',
      createdAt: new Date(0).toISOString(),
    });
  }
  return fallback;
}
