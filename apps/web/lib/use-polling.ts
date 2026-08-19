'use client';

import { useEffect, useRef } from 'react';

/**
 * Slow safety-net refresh while a tab is visible.
 *
 * Live updates go through SSE (`RealtimeProvider`) on the existing Nest
 * EventEmitter bus. Polling remains as a fallback if the stream drops, and
 * still pauses while the tab is hidden.
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
