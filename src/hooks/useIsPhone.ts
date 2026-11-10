import { useSyncExternalStore } from 'react'

/** Keep in sync with `$phone` in index.scss. */
export const PHONE_MAX_WIDTH = 720
const query = `(max-width: ${PHONE_MAX_WIDTH}px)`

export const isPhone = () => window.matchMedia(query).matches

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** Live phone-layout flag; flips on resize / rotation. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone)
}
