'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { getPriorityLabel, type ReportPriorityKey } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

export { StatusBadge } from './status-badge';

const PRIORITY_CLASS: Record<ReportPriorityKey, string> = {
  LOW: 'bg-status-submitted text-status-submitted-foreground',
  MEDIUM: 'bg-semantic-warning text-semantic-warning-foreground',
  HIGH: 'bg-semantic-caution text-semantic-caution-foreground',
  CRITICAL: 'bg-semantic-danger text-semantic-danger-foreground',
};

const TONE_CLASS = {
  neutral: 'bg-status-submitted text-status-submitted-foreground',
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

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const locale = useLocale() as AppLocale;
  const key = priority as ReportPriorityKey;
  const classes = PRIORITY_CLASS[key] ?? PRIORITY_CLASS.LOW;

  return (
    <span className={cn(badgeBase, classes, className)}>{getPriorityLabel(priority, locale)}</span>
  );
}
