'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { colors } from '@/lib/design-tokens';

export function NamedBarChart({
  data,
  emptyLabel,
  fill = colors.mosque[600],
}: {
  data: { name: string; count: number }[];
  emptyLabel: string;
  fill?: string;
}) {
  if (data.length === 0) {
    return <p className="text-small text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.stone[200]} />
          <XAxis
            dataKey="name"
            angle={-20}
            textAnchor="end"
            interval={0}
            height={60}
            tick={{ fontSize: 11, fill: colors.stone[600] }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: colors.stone[600] }}
            width={32}
          />
          <Tooltip />
          <Bar dataKey="count" fill={fill} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
