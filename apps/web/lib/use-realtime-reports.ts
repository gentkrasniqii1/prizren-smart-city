'use client';

import { useEffect } from 'react';
import { getAccessToken } from '@/lib/auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Streams report status changes when a session exists. Falls back silently if unsupported. */
export function useRealtimeReports(onUpdate: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    let stopped = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/realtime/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.includes('report.status')) {
            onUpdate();
            buffer = '';
          }
        }
      } catch {
        /* stream closed or unauthorized */
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [enabled, onUpdate]);
}
