'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  getPriorityLabel,
  getStatusLabel,
  type ReportPriorityKey,
  type ReportStatusKey,
} from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

const STATUS_CLASS: Record<ReportStatusKey, string> = {
  PENDING: 'bg-stone-200 text-stone-900',
  IN_REVIEW: 'bg-mosque-200 text-mosque-950',
  ASSIGNED: 'bg-stone-300 text-stone-950',
  IN_PROGRESS: 'bg-amber-200 text-amber-950',
  RESOLVED: 'bg-river-200 text-river-950',
  REJECTED: 'bg-red-200 text-red-950',
};

const PRIORITY_CLASS: Record<ReportPriorityKey, string> = {
  LOW: 'bg-stone-200 text-stone-900',
  MEDIUM: 'bg-amber-200 text-amber-950',
  HIGH: 'bg-orange-200 text-orange-950',
  CRITICAL: 'bg-red-200 text-red-950',
};

const TONE_CLASS = {
  neutral: 'bg-stone-200 text-stone-900',
  success: 'bg-river-200 text-river-950',
  warning: 'bg-amber-200 text-amber-950',
  danger: 'bg-red-200 text-red-950',
  info: 'bg-mosque-200 text-mosque-950',
} as const;

const badgeBase =
  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  return (
    <span className={cn(badgeBase, 'uppercase', TONE_CLASS[tone], className)}>{children}</span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const locale = useLocale() as AppLocale;
  const key = status as ReportStatusKey;
  const classes = STATUS_CLASS[key] ?? STATUS_CLASS.PENDING;

  return (
    <span className={cn(badgeBase, classes, className)}>{getStatusLabel(status, locale)}</span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const locale = useLocale() as AppLocale;
  const key = priority as ReportPriorityKey;
  const classes = PRIORITY_CLASS[key] ?? PRIORITY_CLASS.LOW;

  return (
    <span className={cn(badgeBase, classes, className)}>{getPriorityLabel(priority, locale)}</span>
  );
}
