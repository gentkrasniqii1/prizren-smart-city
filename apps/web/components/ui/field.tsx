import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const fieldMd =
  'mt-1 w-full min-h-11 rounded-md border bg-card px-3 py-2.5 text-body text-foreground transition duration-fast ease-product placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:py-2';

const fieldSm =
  'mt-0 w-full min-h-11 rounded-md border bg-card px-2.5 py-1.5 text-small text-foreground transition duration-fast ease-product placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

const fieldOk = 'border-input hover:border-muted-foreground/40 focus:border-primary';

const fieldErr =
  'border-destructive focus:border-destructive focus-visible:[outline-color:var(--destructive)]';

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

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldState
>(function Input({ className, invalid, fieldSize = 'md', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldState
>(function Select({ className, invalid, fieldSize = 'md', ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  className,
  invalid,
  describedBy,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn('flex min-h-11 cursor-pointer items-center gap-2.5 text-sm', className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-5 w-5 shrink-0 rounded border-input text-primary accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="text-foreground">{children}</span>
    </label>
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldState
>(function Textarea({ className, invalid, fieldSize = 'md', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldClass(invalid, fieldSize), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
