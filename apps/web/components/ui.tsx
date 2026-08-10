import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function Spinner({ label = 'Duke ngarkuar…' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 text-sm text-stone-600"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200 ${className}`} aria-hidden />;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-10 text-center">
      <p className="text-base font-medium text-stone-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
    >
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Provo sërish
        </button>
      ) : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-stone-200 text-stone-900',
  IN_REVIEW: 'bg-sky-200 text-sky-950',
  ASSIGNED: 'bg-indigo-200 text-indigo-950',
  IN_PROGRESS: 'bg-amber-200 text-amber-950',
  RESOLVED: 'bg-emerald-200 text-emerald-950',
  REJECTED: 'bg-red-200 text-red-950',
};

const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'bg-stone-200 text-stone-900',
  MEDIUM: 'bg-amber-200 text-amber-950',
  HIGH: 'bg-orange-200 text-orange-950',
  CRITICAL: 'bg-red-200 text-red-950',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_CLASS[status] ?? 'bg-stone-200 text-stone-900'}`}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_CLASS[priority] ?? 'bg-stone-200 text-stone-900'}`}
    >
      {priority}
    </span>
  );
}
