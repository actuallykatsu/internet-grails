import { useSyncExternalStore } from 'react';

const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribe(on: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}

/** True when the visitor's system asks for less motion. False during server render. */
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
