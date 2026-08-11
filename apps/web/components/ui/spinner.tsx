import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({
  label = 'Duke ngarkuar…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center gap-3 text-sm text-stone-600', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin text-stone-700" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
