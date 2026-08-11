'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm disabled:opacity-60',
  secondary:
    'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 disabled:opacity-60',
  ghost: 'text-stone-800 hover:bg-stone-100 disabled:opacity-60',
  destructive: 'bg-red-700 text-white hover:bg-red-800 disabled:opacity-60',
  icon: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-60 p-0',
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

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition duration-fast ease-product focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mosque-700',
        variants[variant],
        variant === 'icon' ? iconSizes[size] : sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
