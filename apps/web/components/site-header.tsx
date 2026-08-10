'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export function SiteHeader() {
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
    'rounded-md px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800';

  const navLinks = (
    <>
      <Link href="/reports" className={linkClass} onClick={() => setOpen(false)}>
        Raporte
      </Link>
      <Link href="/report" className={linkClass} onClick={() => setOpen(false)}>
        Raporto
      </Link>
      <Link href="/transparency" className={linkClass} onClick={() => setOpen(false)}>
        Transparenca
      </Link>
      {!loading && isStaff ? (
        <Link href="/admin" className={linkClass} onClick={() => setOpen(false)}>
          Admin
        </Link>
      ) : null}
      {!loading && user ? (
        <>
          <Link href="/notifications" className={linkClass} onClick={() => setOpen(false)}>
            Njoftime
          </Link>
          <Link href="/account" className={linkClass} onClick={() => setOpen(false)}>
            {user.name}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
          >
            Dil
          </button>
        </>
      ) : !loading ? (
        <>
          <Link href="/login" className={linkClass} onClick={() => setOpen(false)}>
            Hyr
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
            onClick={() => setOpen(false)}
          >
            Regjistrohu
          </Link>
        </>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-stone-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Kalo te përmbajtja
      </a>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 sm:text-lg"
        >
          Prizren Smart City
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Kryesore">
          {navLinks}
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800 md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Mbyll menunë' : 'Hap menunë'}</span>
          <span aria-hidden className="flex flex-col gap-1.5">
            <span
              className={`block h-0.5 w-5 bg-stone-800 transition ${open ? 'translate-y-2 rotate-45' : ''}`}
            />
            <span
              className={`block h-0.5 w-5 bg-stone-800 transition ${open ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-0.5 w-5 bg-stone-800 transition ${open ? '-translate-y-2 -rotate-45' : ''}`}
            />
          </span>
        </button>
      </div>

      {open ? (
        <nav
          id={menuId}
          className="border-t border-stone-200 bg-white px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1">{navLinks}</div>
        </nav>
      ) : null}
    </header>
  );
}
