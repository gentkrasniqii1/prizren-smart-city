'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function DepartmentBarChart({
  data,
  emptyLabel,
}: {
  data: { department: string; count: number }[];
  emptyLabel: string;
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
            dataKey="department"
            angle={-20}
            textAnchor="end"
            interval={0}
            height={60}
            tick={{ fontSize: 11, fill: '#57534e' }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#57534e' }} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#2c7c71" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
