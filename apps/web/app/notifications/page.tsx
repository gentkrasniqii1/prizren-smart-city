'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { NotificationDto, PaginatedNotifications } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui';

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<PaginatedNotifications>('/notifications?limit=50', {
      auth: true,
    });
    setItems(res.data);
    setUnreadCount(res.meta.unreadCount);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Nuk u ngarkuan njoftimet');
      }
    })();
  }, [loading, user, load]);

  async function markOne(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deshtoi');
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', auth: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deshtoi');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-stone-600">Duke ngarkuar...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Njoftime</h1>
        <p className="mt-3 text-stone-600">Hyr për të parë njoftimet.</p>
        <Link href="/login" className="mt-6 inline-block underline">
          Hyr
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Njoftime</h1>
          <p className="mt-1 text-sm text-stone-600">{unreadCount} të palexuara</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || unreadCount === 0}
          onClick={() => void markAll()}
        >
          Shëno të gjitha si të lexuara
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-6 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-stone-500">Nuk ka njoftime.</li>
        ) : (
          items.map((n) => (
            <li
              key={n.id}
              className={`border px-4 py-3 ${n.read ? 'border-stone-100 bg-white' : 'border-stone-300 bg-stone-50'}`}
            >
              <p className="text-sm text-stone-800">{n.message ?? n.type}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span>{new Date(n.createdAt).toLocaleString()}</span>
                {n.reportId ? (
                  <Link href={`/reports/${n.reportId}`} className="underline text-stone-800">
                    Hap raportin
                  </Link>
                ) : null}
                {!n.read ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void markOne(n.id)}
                    className="h-auto px-0 py-0 text-xs underline"
                  >
                    Shëno të lexuar
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
