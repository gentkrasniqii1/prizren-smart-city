'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AnalyticsByStatusItem } from '@prizren/shared-types';
import { colors } from '@/lib/design-tokens';
import { getStatusLabel } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

const FILL: Record<string, string> = {
  SUBMITTED: colors.status.submitted.bg,
  RECEIVED: colors.status.received.bg,
  UNDER_REVIEW: colors.status.underReview.bg,
  ASSIGNED: colors.status.assigned.bg,
  IN_PROGRESS: colors.status.inProgress.bg,
  WAITING_FOR_INFORMATION: colors.status.waiting.bg,
  RESOLVED: colors.status.resolved.bg,
  REJECTED: colors.status.rejected.bg,
  DUPLICATE: colors.status.duplicate.bg,
};

export function StatusDistributionChart({
  data,
  emptyLabel,
  locale,
}: {
  data: AnalyticsByStatusItem[];
  emptyLabel: string;
  locale: AppLocale;
}) {
  const rows = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      ...d,
      label: getStatusLabel(d.status, locale),
    }));

  if (rows.length === 0) {
    return <p className="text-small text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex h-64 min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="h-44 w-full min-w-0 sm:h-64 sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
            >
              {rows.map((row) => (
                <Cell key={row.status} fill={FILL[row.status] ?? colors.mosque[600]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center justify-between gap-3 text-small">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: FILL[row.status] ?? colors.mosque[600] }}
                aria-hidden
              />
              <span className="truncate text-foreground">{row.label}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
