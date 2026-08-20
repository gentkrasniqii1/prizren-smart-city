'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth-provider';
import { Logo } from '@/components/brand/Logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/layout/notification-bell';
import { PageContainer } from '@/components/layout/page-container';
import { UserMenu } from '@/components/layout/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Navbar,
  NavbarBrand,
  NavbarCTA,
  NavbarDrawerLink,
  NavbarLink,
  NavbarLinks,
  NavbarRow,
  NavbarUtilities,
  skipLinkClassName,
} from '@/components/ui/navbar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function SiteHeader() {
  const t = useTranslations('Nav');
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <Navbar>
      <a href="#main-content" className={skipLinkClassName()}>
        {t('skipToContent')}
      </a>

      <PageContainer>
        <NavbarRow>
          <NavbarBrand>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center"
              aria-label={t('home')}
              onClick={() => setOpen(false)}
            >
              <span className="lg:hidden">
                <Logo variant="full" size={32} compact />
              </span>
              <span className="hidden lg:inline-flex">
                <Logo variant="full" size={32} />
              </span>
            </Link>
          </NavbarBrand>

          <NavbarLinks label={t('mainNav')}>
            {primaryLinks.map((link) => (
              <NavbarLink key={link.href} href={link.href} active={link.active}>
                {link.label}
              </NavbarLink>
            ))}
            <NavbarCTA>
              <Button asChild size="sm">
                <Link href="/report">{t('reportCta')}</Link>
              </Button>
            </NavbarCTA>
          </NavbarLinks>

          <NavbarUtilities>
            <ThemeToggle />
            {!loading && user ? <UserMenu /> : null}
            <LanguageSwitcher variant="compact" />
            {!loading && user ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                aria-label={t('logout')}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {t('logout')}
              </Button>
            ) : null}
            {!loading && !user ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">{t('login')}</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/register">{t('register')}</Link>
                </Button>
              </>
            ) : null}
          </NavbarUtilities>

          <div className="flex items-center gap-1">
            {!loading && user ? <NotificationBell /> : null}
            <div className="lg:hidden">
              <Button
                type="button"
                variant="icon"
                size="sm"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                aria-label={t('openMenu')}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </div>
        </NavbarRow>
      </PageContainer>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full max-w-sm flex-col gap-0 p-0 lg:hidden">
          <SheetHeader className="border-b border-border px-inset py-gutter pr-14 text-left">
            <SheetTitle>{t('mainNav')}</SheetTitle>
          </SheetHeader>

          <nav
            className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3"
            aria-label={t('mainNav')}
          >
            {primaryLinks.map((link) => (
              <NavbarDrawerLink
                key={link.href}
                href={link.href}
                active={link.active}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavbarDrawerLink>
            ))}

            <div className="px-gutter pt-3">
              <Button asChild className="w-full">
                <Link href="/report" onClick={() => setOpen(false)}>
                  {t('reportCtaShort')}
                </Link>
              </Button>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              {!loading && user ? (
                <NavbarDrawerLink
                  href="/account"
                  active={pathname === '/account' || pathname.startsWith('/account')}
                  onClick={() => setOpen(false)}
                >
                  {t('profile')}
                </NavbarDrawerLink>
              ) : !loading ? (
                <>
                  <NavbarDrawerLink
                    href="/login"
                    active={pathname === '/login'}
                    onClick={() => setOpen(false)}
                  >
                    {t('login')}
                  </NavbarDrawerLink>
                  <NavbarDrawerLink
                    href="/register"
                    active={pathname === '/register'}
                    onClick={() => setOpen(false)}
                  >
                    {t('register')}
                  </NavbarDrawerLink>
                </>
              ) : null}
            </div>
          </nav>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-inset py-gutter pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ThemeToggle />
            <LanguageSwitcher variant="compact" />
          </div>
        </SheetContent>
      </Sheet>
    </Navbar>
  );
}
