import type { ReportDto } from '@prizren/shared-types';

/** Public case URL. UUID still works on the API; prefer publicId so citizens share the incident code. */
export function reportPublicPath(report: Pick<ReportDto, 'publicId'>): string {
  return `/reports/${report.publicId}`;
}
