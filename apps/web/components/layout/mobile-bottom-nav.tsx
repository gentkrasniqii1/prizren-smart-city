'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Home, Map, Plus, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const HIDDEN_PREFIXES = ['/login', '/register', '/auth'];

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

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

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
      href: '/account#reports',
      label: t('myReports'),
      icon: FileText,
      isActive: (p) => p === '/account',
    },
    {
      href: '/account#profile',
      label: t('profile'),
      icon: UserRound,
      isActive: (p) => p === '/notifications',
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
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
                  className="-mt-4 flex flex-col items-center gap-0.5"
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft ring-4 ring-stone-50 transition duration-normal ease-product hover:bg-primary-hover active:scale-95',
                      active && 'ring-mosque-200',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-[10px] font-medium text-mosque-800">{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={key} className="flex justify-center">
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium',
                  active ? 'text-mosque-800' : 'text-stone-600',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'text-mosque-700')} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
