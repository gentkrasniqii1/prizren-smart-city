'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NotificationDto, PaginatedNotifications } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { useNotificationInbox } from '@/components/notifications/notification-inbox';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiFetch } from '@/lib/api';
import { useIsLg } from '@/lib/use-media-query';

export function NotificationBell() {
  const t = useTranslations('Nav');
  const tN = useTranslations('Notifications');
  const { user, loading } = useAuth();
  const { unreadCount, refreshUnread, setUnreadCount } = useNotificationInbox();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [busy, setBusy] = useState(false);
  const isLg = useIsLg();

  const loadPreview = useCallback(async () => {
    const res = await apiFetch<PaginatedNotifications>('/notifications?limit=8', { auth: true });
    setItems(res.data);
    setUnreadCount(res.meta.unreadCount ?? 0);
  }, [setUnreadCount]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      try {
        await loadPreview();
      } catch {
        setItems([]);
      }
    }
  }

  async function markOne(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
      await loadPreview();
    } catch {
      await refreshUnread();
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', auth: true });
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      await refreshUnread();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  const label = unreadCount > 0 ? `${t('notifications')} (${unreadCount})` : t('notifications');

  const trigger = (
    <Button variant="icon" size="sm" className="relative shrink-0" aria-label={label}>
      <Bell className="h-4 w-4" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </Button>
  );

  const markAllButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy || unreadCount === 0}
      onClick={() => void markAll()}
      className="min-h-11 gap-1 px-2"
    >
      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
      {tN('markAll')}
    </Button>
  );

  const listBody = (listClassName: string) =>
    items.length === 0 ? (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tN('emptyBody')}</p>
    ) : (
      <ul className={listClassName}>
        {items.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            compact
            busy={busy}
            onMarkRead={(id) => void markOne(id)}
            onOpen={() => setOpen(false)}
          />
        ))}
      </ul>
    );

  const viewAll = (
    <Button asChild variant="secondary" size="sm" className="w-full">
      <Link href="/notifications" onClick={() => setOpen(false)}>
        {tN('viewAll')}
      </Link>
    </Button>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button
          variant="icon"
          size="sm"
          className="relative shrink-0"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => void handleOpenChange(true)}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
        <Sheet open={!isLg && open} onOpenChange={(next) => void handleOpenChange(next)}>
          <SheetContent
            side="bottom"
            className="flex max-h-[min(78svh,36rem)] flex-col gap-0 rounded-t-2xl border-border p-0 sm:mx-auto sm:max-w-lg"
          >
            <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-2.5 pr-14 text-left">
              <SheetTitle className="text-sm font-semibold">{tN('title')}</SheetTitle>
              {markAllButton}
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{listBody('')}</div>
            <div className="border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {viewAll}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden lg:block">
        {/*
          `modal={false}`: default modal mode sets `data-scroll-locked` /
          `overflow: hidden` on <body>, which breaks the sticky header's
          containing block — the bar jumps/flickers and the click that opened
          the menu can miss the bell. Same opt-out as ThemeToggle / LanguageSwitcher.
        */}
        <DropdownMenu
          modal={false}
          open={isLg && open}
          onOpenChange={(next) => void handleOpenChange(next)}
        >
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">{tN('title')}</p>
              {markAllButton}
            </div>
            <DropdownMenuSeparator className="my-0" />
            {listBody('max-h-80 overflow-y-auto overscroll-contain')}
            <DropdownMenuSeparator className="my-0" />
            <div className="p-2">{viewAll}</div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
