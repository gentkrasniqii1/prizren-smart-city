import { useCallback, useSyncExternalStore } from 'react';

function subscribeToQuery(query: string, onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** SSR and first paint use `ssrValue` (default false = mobile-first). */
export function useMediaQuery(query: string, ssrValue = false) {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToQuery(query, onChange),
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => ssrValue, [ssrValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind `lg` breakpoint (1024px) used for desktop chrome in this app. */
export function useIsLg() {
  return useMediaQuery('(min-width: 1024px)');
}
