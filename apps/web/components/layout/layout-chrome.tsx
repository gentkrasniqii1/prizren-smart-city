'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
  '/auth/two-factor',
];

function isAuthPath(pathname: string | null) {
  if (!pathname) return false;
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function LayoutChrome({
  header,
  footer,
  nav,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  nav: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {header}
      {children}
      {footer}
      {nav}
    </div>
  );
}
