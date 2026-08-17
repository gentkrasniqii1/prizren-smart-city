'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth-provider';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

function isStaffRole(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

export function UserMenu() {
  const t = useTranslations('Nav');
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading || !user) return null;

  const staff = isStaffRole(user.role);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-stone-800',
          'hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mosque-700',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar name={user.name} size={28} />
        <span className="hidden max-w-[9rem] truncate lg:inline">{user.name}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-stone-500 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-stone-200 bg-card py-1 shadow-lift"
        >
          <div className="border-b border-stone-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-stone-900">{user.name}</p>
            <p className="truncate text-xs text-stone-600">{user.email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-stone-500" aria-hidden />
            {t('account')}
          </Link>
          {staff ? (
            <Link
              href="/admin"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4 text-stone-500" aria-hidden />
              {t('admin')}
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
