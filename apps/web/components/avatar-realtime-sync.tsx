'use client';

import { useAuth } from '@/components/auth-provider';
import { useRealtime } from '@/components/realtime-provider';

/** Keeps the signed-in user's avatar in sync when another tab uploads/removes it. */
export function AvatarRealtimeSync() {
  const { user, updateUser } = useAuth();

  useRealtime((event) => {
    if (event.type !== 'user.avatar.updated') return;
    if (!user || event.userId !== user.id) return;
    updateUser({ ...user, avatarUrl: event.avatarUrl ?? null });
  }, Boolean(user));

  return null;
}
