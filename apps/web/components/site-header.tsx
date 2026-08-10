'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';

export function SiteHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-stone-900">
          Prizren Smart City
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-700">
          <Link href="/reports" className="hover:text-stone-900">
            Raporte
          </Link>
          <Link href="/report" className="hover:text-stone-900">
            Raporto
          </Link>
          <Link href="/transparency" className="hover:text-stone-900">
            Transparenca
          </Link>
          {!loading &&
            user &&
            (user.role === 'DEPARTMENT_STAFF' ||
              user.role === 'DEPARTMENT_ADMIN' ||
              user.role === 'SUPER_ADMIN') && (
              <Link href="/admin" className="hover:text-stone-900">
                Admin
              </Link>
            )}
          {!loading && user ? (
            <>
              <Link href="/notifications" className="hover:text-stone-900">
                Njoftime
              </Link>
              <Link href="/account" className="hover:text-stone-900">
                {user.name}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-50"
              >
                Dil
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-stone-900">
                Hyr
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-800"
              >
                Regjistrohu
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
