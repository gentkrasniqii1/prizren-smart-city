'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations('Common');

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="mt-1 h-auto px-0 py-0 text-red-900 underline underline-offset-2 hover:bg-transparent hover:text-red-950"
          >
            {t('retry')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
