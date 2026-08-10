'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth-provider';
import { BrandWordmark } from '@/components/brand';
import { LanguageSwitcher } from '@/components/language-switcher';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  const t = useTranslations('Nav');
  const { user, loading, logout } = useAuth();
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isStaff =
    user &&
    (user.role === 'DEPARTMENT_STAFF' ||
      user.role === 'DEPARTMENT_ADMIN' ||
      user.role === 'SUPER_ADMIN');

  const linkClass =
    'rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950';

  const navLinks = (
    <>
      <Link href="/reports" className={linkClass} onClick={() => setOpen(false)}>
        {t('reports')}
      </Link>
      <Link href="/report" className={linkClass} onClick={() => setOpen(false)}>
        {t('report')}
      </Link>
      <Link href="/transparency" className={linkClass} onClick={() => setOpen(false)}>
        {t('transparency')}
      </Link>
      {!loading && isStaff ? (
        <Link href="/admin" className={linkClass} onClick={() => setOpen(false)}>
          {t('admin')}
        </Link>
      ) : null}
      {!loading && user ? (
        <>
          <Link href="/notifications" className={linkClass} onClick={() => setOpen(false)}>
            {t('notifications')}
          </Link>
          <Link
            href="/account"
            className={`${linkClass} inline-flex items-center gap-2`}
            onClick={() => setOpen(false)}
          >
            <UserAvatar name={user.name} size={28} />
            <span className="max-w-[8rem] truncate">{user.name}</span>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            {t('logout')}
          </Button>
        </>
      ) : !loading ? (
        <>
          <Link href="/login" className={linkClass} onClick={() => setOpen(false)}>
            {t('login')}
          </Link>
          <Link href="/register" onClick={() => setOpen(false)}>
            <Button size="sm">{t('register')}</Button>
          </Link>
        </>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mosque-800 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        {t('skipToContent')}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="min-w-0 shrink">
          <BrandWordmark />
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <nav className="flex items-center gap-0.5" aria-label="Main">
            {navLinks}
          </nav>
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? t('closeMenu') : t('openMenu')}</span>
            <span aria-hidden className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-stone-800" />
              <span className="block h-0.5 w-5 bg-stone-800" />
              <span className="block h-0.5 w-5 bg-stone-800" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav id={menuId} className="border-t border-stone-200 bg-stone-50 px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">{navLinks}</div>
        </nav>
      ) : null}
    </header>
  );
}
