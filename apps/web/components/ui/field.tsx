import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const fieldMd =
  'mt-1 w-full min-h-11 rounded-md border bg-card px-3 py-2.5 text-body text-foreground outline-none transition duration-fast ease-product placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:min-h-10 sm:py-2 sm:text-small';

const fieldSm =
  'mt-0 w-full min-h-9 rounded-md border bg-card px-2.5 py-1.5 text-small text-foreground outline-none transition duration-fast ease-product placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

const fieldOk =
  'border-input hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-ring/20';

const fieldErr =
  'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20';

type FieldState = {
  invalid?: boolean;
  fieldSize?: 'sm' | 'md';
};

function fieldClass(invalid?: boolean, fieldSize: 'sm' | 'md' = 'md') {
  return cn(fieldSize === 'sm' ? fieldSm : fieldMd, invalid ? fieldErr : fieldOk);
}

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-label text-muted-foreground', className)}>
      {children}
    </label>
  );
}

export function Input({
  className,
  invalid,
  fieldSize = 'md',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldState) {
  return (
    <input
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  fieldSize = 'md',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldState) {
  return (
    <select
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-start gap-2.5 text-sm', className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="text-foreground">{children}</span>
    </label>
  );
}

export function Textarea({
  className,
  invalid,
  fieldSize = 'md',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldState) {
  return (
    <textarea
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
