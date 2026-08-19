'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { RealtimeEvent } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { ensureAccessToken, refreshAccessToken } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Listener = (event: RealtimeEvent) => void;

type RealtimeContextValue = {
  subscribe: (listener: Listener) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function parseSse(buffer: string): { rest: string; frames: { event: string; data: string }[] } {
  const frames: { event: string; data: string }[] = [];
  let rest = buffer.replace(/\r\n/g, '\n');
  while (true) {
    const split = rest.indexOf('\n\n');
    if (split === -1) break;
    const block = rest.slice(0, split);
    rest = rest.slice(split + 2);
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') });
  }
  return { rest, frames };
}

async function openStream(
  signal: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
  let token = await ensureAccessToken();
  if (!token) {
    token = await refreshAccessToken();
  }
  if (!token) return null;

  const response = await fetch(`${API_URL}/realtime/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    credentials: 'include',
    signal,
  });

  if (response.status === 401) {
    const next = await refreshAccessToken();
    if (!next || signal.aborted) return null;
    const retry = await fetch(`${API_URL}/realtime/stream`, {
      headers: {
        Authorization: `Bearer ${next}`,
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      signal,
    });
    if (!retry.ok || !retry.body) return null;
    return retry.body.getReader();
  }

  if (!response.ok || !response.body) return null;
  return response.body.getReader();
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const dispatch = useCallback((event: RealtimeEvent) => {
    listeners.current.forEach((listener) => listener(event));
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    let stopped = false;
    let attempt = 0;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const disconnect = () => {
      controller?.abort();
      controller = null;
    };

    const schedule = (delayMs: number) => {
      clearReconnect();
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delayMs);
    };

    const connect = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      disconnect();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const reader = await openStream(signal);
        if (!reader) {
          attempt += 1;
          schedule(Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4)));
          return;
        }
        attempt = 0;
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSse(buffer);
          buffer = parsed.rest;
          for (const frame of parsed.frames) {
            if (frame.event === 'ready') continue;
            try {
              const payload = JSON.parse(frame.data) as RealtimeEvent;
              if (payload?.type) dispatch(payload);
            } catch {
              // ignore malformed frames
            }
          }
        }
      } catch {
        // aborted or network drop
      }
      if (!stopped && document.visibilityState === 'visible') {
        attempt += 1;
        schedule(Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4)));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearReconnect();
        disconnect();
        return;
      }
      attempt = 0;
      void connect();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void connect();

    return () => {
      stopped = true;
      clearReconnect();
      disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loading, user?.id, dispatch]);

  return <RealtimeContext.Provider value={{ subscribe }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(
  onEvent: (event: RealtimeEvent) => void,
  enabled = true,
  filter?: (event: RealtimeEvent) => boolean,
): void {
  const ctx = useContext(RealtimeContext);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    if (!ctx || !enabled) return;
    return ctx.subscribe((event) => {
      if (filterRef.current && !filterRef.current(event)) return;
      onEventRef.current(event);
    });
  }, [ctx, enabled]);
}

/** Debounced refresh so create + assign + notification arrive as one reload. */
export function useRealtimeRefresh(
  callback: () => void,
  enabled = true,
  filter?: (event: RealtimeEvent) => boolean,
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useRealtime(
    () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => callbackRef.current(), 300);
    },
    enabled,
    filter,
  );
}
