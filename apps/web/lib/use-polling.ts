'use client';

import { useEffect, useRef } from 'react';

/**
 * Periodically re-runs `callback` on a fixed interval while `enabled`.
 *
 * We deliberately use polling/revalidate instead of a WebSocket/SSE channel
 * here: the previous SSE stream only covered status-change events (not new
 * reports), had no client-side reconnect logic (a single dropped connection
 * silently stopped all live updates until a manual page refresh — the exact
 * failure mode this is meant to prevent), and was never load-tested. Plain
 * polling is simpler, self-heals after any network blip, and is more than
 * fast enough for a civic-reporting dashboard's update cadence.
 *
 * Polling pauses while the tab is hidden (no wasted requests in background
 * tabs) and resumes — with an immediate refresh — as soon as it becomes
 * visible again.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => callbackRef.current();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
