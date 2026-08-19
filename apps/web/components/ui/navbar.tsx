import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Navbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </header>
  );
}

export function NavbarRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-14 items-center justify-between gap-gutter lg:h-16', className)}>
      {children}
    </div>
  );
}

export function NavbarBrand({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 shrink-0', className)}>{children}</div>;
}

export function NavbarLinks({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <nav className={cn('hidden min-w-0 items-center gap-1 lg:flex', className)} aria-label={label}>
      {children}
    </nav>
  );
}

export function NavbarLink({
  href,
  active,
  children,
  className,
  onClick,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center rounded-md px-3 text-label transition duration-fast ease-product',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function NavbarDrawerLink({
  href,
  active,
  children,
  className,
  onClick,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <NavbarLink
      href={href}
      active={active}
      onClick={onClick}
      className={cn('w-full justify-start px-gutter', className)}
    >
      {children}
    </NavbarLink>
  );
}

export function NavbarCTA({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('lg:ml-2', className)}>{children}</div>;
}

export function NavbarUtilities({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('hidden items-center gap-1 lg:flex', className)}>{children}</div>;
}

export function NavbarUser({
  href,
  name,
  children,
  className,
}: {
  href: string;
  name: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      title={name}
      className={cn(
        'inline-flex min-h-11 max-w-[11rem] shrink items-center gap-2 rounded-md px-2 text-label text-foreground',
        'hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
      <span className="min-w-0 truncate">{name}</span>
    </Link>
  );
}

export function skipLinkClassName() {
  return 'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground';
}

export type NavbarLinkProps = ComponentPropsWithoutRef<typeof NavbarLink>;
