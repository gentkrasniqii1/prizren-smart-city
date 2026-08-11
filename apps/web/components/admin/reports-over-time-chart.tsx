'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function ReportsOverTimeChart({
  data,
  emptyLabel,
}: {
  data: { date: string; count: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-stone-500">{emptyLabel}</p>;
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#57534e' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#57534e' }} width={32} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#335f9b"
            strokeWidth={2}
            dot={{ r: 3, fill: '#335f9b' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
