'use client';

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { fieldClass } from '@/components/ui/field';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsLg } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

export type SelectSheetOption = { value: string; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  title: string;
  invalid?: boolean;
  fieldSize?: 'sm' | 'md';
  options?: SelectSheetOption[];
  children?: ReactNode;
};

function optionsFromChildren(children: ReactNode): SelectSheetOption[] {
  const options: SelectSheetOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type !== 'option') return;
    const props = child.props as { value?: string | number; children?: ReactNode };
    const label =
      typeof props.children === 'string' || typeof props.children === 'number'
        ? String(props.children)
        : Children.toArray(props.children).join('');
    options.push({ value: String(props.value ?? ''), label });
  });
  return options;
}

function emitChange(onChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'], value: string) {
  if (!onChange) return;
  onChange({ target: { value } } as ChangeEvent<HTMLSelectElement>);
}

export function SelectSheet({
  id,
  title,
  value,
  onChange,
  options,
  children,
  className,
  invalid,
  fieldSize = 'md',
  disabled,
  name,
  required,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const isLg = useIsLg();
  const resolvedOptions = useMemo(
    () => (options && options.length > 0 ? options : optionsFromChildren(children)),
    [options, children],
  );
  const current = String(value ?? '');
  const selectedLabel =
    resolvedOptions.find((o) => o.value === current)?.label ?? resolvedOptions[0]?.label ?? '';

  function pick(next: string) {
    emitChange(onChange, next);
    setOpen(false);
  }

  return (
    <>
      <select
        id={id}
        name={name}
        value={current}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        className={cn(fieldClass(invalid, fieldSize), 'hidden lg:block', className)}
        {...rest}
      >
        {children ??
          resolvedOptions.map((o) => (
            <option key={o.value || '__all'} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>

      <button
        type="button"
        id={id ? `${id}-mobile` : undefined}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        className={cn(
          fieldClass(invalid, fieldSize),
          'flex items-center justify-between gap-2 text-left lg:hidden',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={!isLg && open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(70svh,32rem)] gap-0 rounded-t-2xl border-border p-0 sm:mx-auto sm:max-w-lg"
        >
          <SheetHeader className="space-y-0 border-b border-border px-4 py-3 pr-14 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <ul className="max-h-[min(60svh,28rem)] overflow-y-auto overscroll-contain p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {resolvedOptions.map((o) => {
              const selected = o.value === current;
              return (
                <li key={o.value || '__all'}>
                  <button
                    type="button"
                    onClick={() => pick(o.value)}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition duration-fast ease-product',
                      selected
                        ? 'bg-muted font-semibold text-foreground'
                        : 'text-foreground hover:bg-muted/60',
                    )}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
