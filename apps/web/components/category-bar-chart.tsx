'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsByCategoryItem } from '@prizren/shared-types';

export function CategoryBarChart({
  data,
  emptyLabel = 'Nuk ka të dhëna për grafikun.',
}: {
  data: AnalyticsByCategoryItem[];
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-stone-500">{emptyLabel}</p>;
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis
            dataKey="category"
            angle={-25}
            textAnchor="end"
            interval={0}
            height={60}
            tick={{ fontSize: 11, fill: '#57534e' }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#57534e' }} />
          <Tooltip />
          <Bar dataKey="count" fill="#335f9b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
