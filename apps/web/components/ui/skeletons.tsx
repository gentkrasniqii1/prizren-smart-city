import type { ReactNode } from 'react';
import { PageContainer } from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function SkeletonStatus({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </div>
  );
}

export function ReportCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex gap-3 border-b border-border p-3">
        <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2 py-0.5">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ReportCardListSkeleton({
  count = 5,
  compact = true,
}: {
  count?: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'space-y-3'}>
      {Array.from({ length: count }, (_, i) => (
        <ReportCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative min-h-[12rem] overflow-hidden bg-muted dark:bg-stone-900', className)}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          color: 'var(--muted-foreground)',
        }}
      />
      <div className="absolute inset-x-[8%] top-[38%] h-1.5 rounded-full bg-foreground/10" />
      <div className="absolute inset-y-[16%] left-[34%] w-1.5 rounded-full bg-foreground/10" />
      <div className="absolute inset-x-[22%] bottom-[28%] h-1 rounded-full bg-foreground/[0.07]" />
      <span className="absolute left-[26%] top-[34%] h-2.5 w-2.5 animate-pulse rounded-full bg-mosque-600/60" />
      <span className="absolute left-[58%] top-[48%] h-2.5 w-2.5 animate-pulse rounded-full bg-river-600/50 [animation-delay:200ms]" />
      <span className="absolute left-[44%] top-[62%] h-2.5 w-2.5 animate-pulse rounded-full bg-mosque-500/40 [animation-delay:400ms]" />
      <div className="absolute right-3 top-3 space-y-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn('grid gap-3', count >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}
    >
      {Array.from({ length: count }, (_, i) => (
        <MetricSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex h-64 items-end gap-2 rounded-md bg-muted/40 p-4', className)}
      aria-hidden
    >
      {[42, 68, 35, 80, 52, 74, 46, 62].map((h, i) => (
        <Skeleton key={i} className="w-full rounded-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className={i === 0 ? 'h-3 w-14' : 'h-3 w-full max-w-[7rem]'} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/50 px-3 py-2.5">
        <div className="flex gap-6">
          {Array.from({ length: Math.min(cols, 6) }, (_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex items-start gap-4">
      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  );
}

export function NotificationItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex gap-3', compact ? 'px-3 py-3' : 'px-4 py-3.5')}>
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({
  count = 5,
  compact = false,
}: {
  count?: number;
  compact?: boolean;
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: count }, (_, i) => (
        <NotificationItemSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}

export function ReportDetailSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-4 w-28" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-3/4 max-w-md" />
            <Skeleton className="aspect-[16/10] w-full rounded-lg" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-3">
            <MapSkeleton className="h-48 rounded-md" />
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function ReportsPageSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-2">
      <PageContainer className="py-5 sm:py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-5 rounded-lg border border-border bg-card p-3 sm:p-4">
          <Skeleton className="h-11 w-full" />
          <div className="mt-3 hidden gap-2 sm:flex">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </PageContainer>
      <PageContainer width="wide" className="hidden pb-8 lg:block">
        <div className="grid h-[min(70vh,720px)] overflow-hidden rounded-xl border border-border bg-muted lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <div className="min-h-0 border-r border-border bg-card">
            <div className="border-b border-border px-3 py-2.5">
              <Skeleton className="h-4 w-24" />
            </div>
            <ReportCardListSkeleton count={6} compact />
          </div>
          <MapSkeleton className="h-full min-h-0" />
        </div>
      </PageContainer>
      <div className="pb-bottom-nav lg:hidden">
        <MapSkeleton className="h-[42svh] rounded-none" />
        <div className="-mt-3 overflow-hidden rounded-t-2xl border border-border bg-card">
          <div className="flex justify-center py-2">
            <Skeleton className="h-1 w-10 rounded-full" />
          </div>
          <ReportCardListSkeleton count={4} compact />
        </div>
      </div>
    </SkeletonStatus>
  );
}

export function DashboardSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Skeleton className="h-3 w-32" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="mt-8 space-y-3">
          <Skeleton className="h-3 w-28" />
          <MetricGridSkeleton count={4} />
        </div>
        <div className="mt-6 space-y-3">
          <Skeleton className="h-3 w-24" />
          <MetricGridSkeleton count={3} />
        </div>
        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-36" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <ChartSkeleton />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <ChartSkeleton />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <ChartSkeleton className="h-48" />
            </div>
          </div>
        </div>
        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-32" />
          <MapSkeleton className="h-72 rounded-xl border border-border" />
        </div>
        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-40" />
          <TableSkeleton rows={6} cols={7} />
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function AccountPageSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="default">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <ProfileSkeleton />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <div className="mt-8">
          <MetricGridSkeleton count={4} />
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)]">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ReportCardListSkeleton count={4} compact />
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-32" />
              <div className="mt-3 space-y-2">
                <NotificationItemSkeleton compact />
                <NotificationItemSkeleton compact />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function TransparencyPageSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="default">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-56 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-8">
          <MetricGridSkeleton count={4} />
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-4/5 rounded-full" />
            <Skeleton className="h-2 w-3/5 rounded-full" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-2/3 rounded-full" />
            <Skeleton className="h-2 w-1/2 rounded-full" />
          </div>
        </div>
        <div className="mt-10">
          <Skeleton className="h-5 w-36" />
          <MapSkeleton className="mt-4 h-[min(50vh,22rem)] rounded-xl border border-border" />
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function ReportFormSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 flex-1 rounded-full" />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="mt-8 flex justify-between">
            <Skeleton className="h-11 w-24" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function NotificationsPageSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus label={label} className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mt-6">
          <NotificationListSkeleton count={6} />
        </div>
      </PageContainer>
    </SkeletonStatus>
  );
}

export function AuthSessionSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonStatus
      label={label}
      className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4"
    >
      <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-2 w-2/3 rounded-full" />
        </div>
      </div>
    </SkeletonStatus>
  );
}
