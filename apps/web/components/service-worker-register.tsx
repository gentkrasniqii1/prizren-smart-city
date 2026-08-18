'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/react';

/** Registers the app-shell/offline-fallback service worker (see /public/sw.js). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Dev chunks are not content-hashed. Caching them makes the client bundle
    // lag behind SSR HTML and throws a hydration mismatch on every edit.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      Sentry.captureException(error);
    });
  }, []);

  return null;
}
