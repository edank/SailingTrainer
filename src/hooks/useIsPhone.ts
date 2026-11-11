import { useSyncExternalStore } from 'react'

/** Keep in sync with `$phone` / `$phone-landscape-height` in index.scss. */
export const PHONE_MAX_WIDTH = 720
/** A phone on its side is wider than PHONE_MAX_WIDTH, so it's recognised by its short height instead. */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500
const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px), (orientation: landscape) and (max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT}px)`
/** Upright phone: the phone layout minus the `phone-landscape` mixin. */
const PHONE_PORTRAIT_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px) and (orientation: portrait)`

/** Live match of a media query; flips on resize / rotation. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Phone layout, portrait or landscape. */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY)
}

/** Phone held upright. */
export function useIsPhonePortrait(): boolean {
  return useMediaQuery(PHONE_PORTRAIT_QUERY)
}
