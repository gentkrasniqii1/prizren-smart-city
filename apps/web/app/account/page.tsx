'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-stone-600">Duke ngarkuar…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Llogaria ime</h1>
      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="text-stone-500">Emri</dt>
          <dd className="text-lg text-stone-900">{user.name}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Email</dt>
          <dd className="text-lg text-stone-900">{user.email}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Roli</dt>
          <dd className="text-lg text-stone-900">{user.role}</dd>
        </div>
      </dl>
    </main>
  );
}
