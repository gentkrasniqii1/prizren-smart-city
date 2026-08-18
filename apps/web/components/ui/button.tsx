'use client';

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
type Size = 'sm' | 'md' | 'lg';

export type ButtonStatus = 'idle' | 'loading' | 'success' | 'error';

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:brightness-95',
  secondary:
    'border border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted active:bg-muted/80',
  ghost: 'text-foreground hover:bg-muted active:bg-muted/80',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 active:brightness-95',
  icon: 'border border-border bg-card text-foreground hover:bg-muted active:bg-muted/80 p-0',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 py-2 text-sm rounded-md sm:min-h-0 sm:py-1.5',
  md: 'min-h-11 px-4 py-2.5 text-sm rounded-md',
  lg: 'min-h-12 px-5 py-3 text-base rounded-lg',
};

const iconSizes: Record<Size, string> = {
  sm: 'h-10 w-10 rounded-md',
  md: 'h-11 w-11 rounded-md',
  lg: 'h-12 w-12 rounded-lg',
};

const statusClass: Record<ButtonStatus, string> = {
  idle: '',
  loading: 'cursor-wait',
  success:
    'border-transparent bg-river-600 text-white shadow-none hover:bg-river-600 active:brightness-100',
  error: 'ring-2 ring-destructive ring-offset-2 ring-offset-background',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Visual + interaction state. `loading` is an alias for status="loading". */
  status?: ButtonStatus;
  loading?: boolean;
  children: ReactNode;
};

export function resolveButtonStatus(
  status: ButtonStatus | undefined,
  loading?: boolean,
): ButtonStatus {
  if (loading) return 'loading';
  return status ?? 'idle';
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    status = 'idle',
    loading = false,
    className,
    children,
    type = 'button',
    disabled,
    onClick,
    ...rest
  },
  ref,
) {
  const resolved = resolveButtonStatus(status, loading);
  const locked = Boolean(disabled) || resolved === 'loading' || resolved === 'success';

  return (
    <button
      ref={ref}
      type={type}
      disabled={locked}
      aria-busy={resolved === 'loading' || undefined}
      aria-disabled={locked || undefined}
      data-status={resolved}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition duration-fast ease-product',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'active:scale-[0.99]',
        'disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100',
        variants[variant],
        variant === 'icon' ? iconSizes[size] : sizes[size],
        statusClass[resolved],
        className,
      )}
      onClick={(event) => {
        if (locked) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {resolved === 'loading' ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : null}
      {resolved === 'success' ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {resolved === 'error' ? <CircleAlert className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
});
