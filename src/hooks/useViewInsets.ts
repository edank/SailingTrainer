import { useEffect, type RefObject } from 'react'

/**
 * Screen pixels covered by UI at the top and bottom edges. The camera frames the boat in the strip
 * between them. Read per frame by CameraRig; stays 0 where nothing reports (desktop).
 */
export const viewInsets = { top: 0, bottom: 0 }

/** Keep `viewInsets[edge]` equal to how far `ref`'s element reaches in from that screen edge. */
export function useReportInset(ref: RefObject<HTMLElement | null>, edge: 'top' | 'bottom', enabled = true) {
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      viewInsets[edge] = edge === 'top' ? r.bottom : window.innerHeight - r.top
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      viewInsets[edge] = 0
    }
  }, [ref, edge, enabled])
}
