import type { ReactNode } from 'react';

const STATUS: Record<string, string> = {
  PENDING: 'bg-stone-200 text-stone-900',
  IN_REVIEW: 'bg-mosque-200 text-mosque-950',
  ASSIGNED: 'bg-stone-300 text-stone-950',
  IN_PROGRESS: 'bg-amber-200 text-amber-950',
  RESOLVED: 'bg-river-200 text-river-950',
  REJECTED: 'bg-red-200 text-red-950',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-stone-200 text-stone-900',
    success: 'bg-river-200 text-river-950',
    warning: 'bg-amber-200 text-amber-950',
    danger: 'bg-red-200 text-red-950',
    info: 'bg-mosque-200 text-mosque-950',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS[status] ?? STATUS.PENDING}`}
    >
      {status}
    </span>
  );
}
