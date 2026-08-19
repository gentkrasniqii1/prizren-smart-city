'use client';

import { useAuth } from '@/components/auth-provider';
import { UserAvatar } from '@/components/user-avatar';
import { NavbarUser } from '@/components/ui/navbar';

export function UserMenu() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <NavbarUser href="/account" name={user.name}>
      <UserAvatar name={user.name} size={28} />
    </NavbarUser>
  );
}
