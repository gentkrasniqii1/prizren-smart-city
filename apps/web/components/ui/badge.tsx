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
  PENDING: 'bg-status-pending text-status-pending-foreground',
  IN_REVIEW: 'bg-status-review text-status-review-foreground',
  ASSIGNED: 'bg-status-assigned text-status-assigned-foreground',
  IN_PROGRESS: 'bg-status-progress text-status-progress-foreground',
  WAITING_FOR_INFORMATION: 'bg-status-waiting text-status-waiting-foreground',
  RESOLVED: 'bg-status-resolved text-status-resolved-foreground',
  REJECTED: 'bg-status-rejected text-status-rejected-foreground',
  DUPLICATE: 'bg-status-duplicate text-status-duplicate-foreground',
};

const PRIORITY_CLASS: Record<ReportPriorityKey, string> = {
  LOW: 'bg-status-pending text-status-pending-foreground',
  MEDIUM: 'bg-semantic-warning text-semantic-warning-foreground',
  HIGH: 'bg-semantic-caution text-semantic-caution-foreground',
  CRITICAL: 'bg-semantic-danger text-semantic-danger-foreground',
};

const TONE_CLASS = {
  neutral: 'bg-status-pending text-status-pending-foreground',
  success: 'bg-semantic-success text-semantic-success-foreground',
  warning: 'bg-semantic-warning text-semantic-warning-foreground',
  danger: 'bg-semantic-danger text-semantic-danger-foreground',
  info: 'bg-semantic-info text-semantic-info-foreground',
} as const;

const badgeBase =
  'inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold tracking-wide';

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
