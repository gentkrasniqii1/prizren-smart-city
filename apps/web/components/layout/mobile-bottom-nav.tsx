'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, Home, Map, Plus, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';

const HIDDEN_PREFIXES = [
  '/login',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
  isActive: (pathname: string) => boolean;
};

export function MobileBottomNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { user } = useAuth();

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const accountHref = user ? '/account' : '/login';
  const accountLabel = user ? t('account') : t('login');

  const items: NavItem[] = [
    {
      href: '/',
      label: t('home'),
      icon: Home,
      isActive: (p) => p === '/',
    },
    {
      href: '/reports',
      label: t('map'),
      icon: Map,
      isActive: (p) => p === '/reports' || p.startsWith('/reports/'),
    },
    {
      href: '/report',
      label: t('report'),
      icon: Plus,
      primary: true,
      isActive: (p) => p === '/report',
    },
    {
      href: '/transparency',
      label: t('transparency'),
      icon: BarChart3,
      isActive: (p) => p === '/transparency',
    },
    {
      href: accountHref,
      label: accountLabel,
      icon: UserRound,
      isActive: (p) => p === '/account' || p.startsWith('/account') || p === '/notifications',
    },
  ];

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label={t('mobileNav')}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          const key = `${item.href}-${item.label}`;

          if (item.primary) {
            return (
              <li key={key} className="flex justify-center">
                <Link
                  href={item.href}
                  className="-mt-4 flex min-w-11 flex-col items-center gap-0.5"
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft ring-4 ring-background transition duration-fast ease-product hover:bg-primary-hover active:scale-[0.99] motion-reduce:active:scale-100',
                      active && 'ring-mosque-200',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-[10px] font-medium text-primary">{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={key} className="flex justify-center">
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'text-primary')} aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
