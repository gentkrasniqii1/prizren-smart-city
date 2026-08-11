'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth-provider';
import { BrandWordmark } from '@/components/brand';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/layout/notification-bell';
import { PageContainer } from '@/components/layout/page-container';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function navLinkClass(active: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm font-medium transition',
    active
      ? 'bg-mosque-100 text-mosque-900'
      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-950',
  );
}

export function SiteHeader() {
  const t = useTranslations('Nav');
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const first = document.getElementById(menuId)?.querySelector<HTMLElement>('a, button');
    first?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, menuId]);

  const primaryLinks = [
    {
      href: '/reports',
      label: t('reports'),
      active: pathname === '/reports' || pathname.startsWith('/reports/'),
    },
    {
      href: '/transparency',
      label: t('transparency'),
      active: pathname === '/transparency',
    },
    {
      href: '/#how-it-works',
      label: t('howItWorks'),
      active: false,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mosque-800 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        {t('skipToContent')}
      </a>

      <PageContainer className="flex h-14 items-center justify-between gap-3 sm:h-16">
        <Link href="/" className="min-w-0 shrink" onClick={() => setOpen(false)}>
          <span className="md:hidden">
            <BrandWordmark compact />
          </span>
          <span className="hidden md:inline-flex">
            <BrandWordmark />
          </span>
        </Link>

        {/* Desktop primary nav — kept lean; account actions sit on the right */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label={t('mainNav')}>
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link.active)}>
              {link.label}
            </Link>
          ))}
          <Link href="/report" className="ml-2">
            <Button size="sm">{t('reportCta')}</Button>
          </Link>
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          {!loading && user ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className={navLinkClass(pathname === '/login')}>
                {t('login')}
              </Link>
              <Link href="/register">
                <Button size="sm" variant="secondary">
                  {t('register')}
                </Button>
              </Link>
            </>
          ) : null}
          <LanguageSwitcher />
        </div>

        {/* Mobile top bar: language + menu (primary actions live in bottom nav) */}
        <div className="flex items-center gap-1 md:hidden">
          {!loading && user ? <NotificationBell /> : null}
          <LanguageSwitcher />
          <Button
            type="button"
            variant="icon"
            size="sm"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t('closeMenu') : t('openMenu')}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </Button>
        </div>
      </PageContainer>

      {open ? (
        <nav
          id={menuId}
          className="border-t border-stone-200 bg-stone-50 md:hidden"
          aria-label={t('mainNav')}
        >
          <PageContainer className="flex flex-col gap-1 py-3 pb-bottom-nav">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(navLinkClass(link.active), 'min-h-11 px-3 py-3')}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/report" onClick={() => setOpen(false)} className="pt-1">
              <Button size="sm" className="w-full min-h-11">
                {t('reportCta')}
              </Button>
            </Link>
            {!loading && !user ? (
              <div className="mt-2 flex flex-col gap-1 border-t border-stone-200 pt-2">
                <Link
                  href="/login"
                  className={cn(navLinkClass(pathname === '/login'), 'min-h-11 px-3 py-3')}
                  onClick={() => setOpen(false)}
                >
                  {t('login')}
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}>
                  <Button size="sm" variant="secondary" className="w-full min-h-11">
                    {t('register')}
                  </Button>
                </Link>
              </div>
            ) : null}
            {!loading && user ? (
              <div className="mt-2 border-t border-stone-200 pt-2">
                <UserMenu />
              </div>
            ) : null}
          </PageContainer>
        </nav>
      ) : null}
    </header>
  );
}
