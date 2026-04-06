import { useSyncExternalStore } from 'react';

const MD_MIN_WIDTH_QUERY = '(min-width: 768px)';

function subscribeMdMq(onStoreChange: () => void) {
  const mq = window.matchMedia(MD_MIN_WIDTH_QUERY);
  const handler = () => onStoreChange();
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}

function getMdMqSnapshot() {
  return window.matchMedia(MD_MIN_WIDTH_QUERY).matches;
}

function getMdMqServerSnapshot() {
  return false;
}

/** Tailwind `md`: `useSyncExternalStore` evita parpadeos y APIs viejas de Safari. */
export function useIsMdUp(): boolean {
  return useSyncExternalStore(subscribeMdMq, getMdMqSnapshot, getMdMqServerSnapshot);
}
