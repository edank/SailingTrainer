import { useSyncExternalStore } from 'react'

/** Keep in sync with `$phone` / `$phone-landscape-height` in index.scss. */
export const PHONE_MAX_WIDTH = 720
/** A phone on its side is wider than PHONE_MAX_WIDTH, so it's recognised by its short height instead. */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500
const query = `(max-width: ${PHONE_MAX_WIDTH}px), (orientation: landscape) and (max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT}px)`

export const isPhone = () => window.matchMedia(query).matches

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** Live phone-layout flag (portrait or landscape); flips on resize / rotation. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone)
}
