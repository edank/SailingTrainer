import { useEffect, useMemo, useRef } from 'react'
import { nextCamera, useSim } from '../store'

/** On-screen buttons write key names here; polled alongside the real keyboard. */
export const virtualKeys = new Set<string>()

/** Zoom change per + / − press. */
const KEY_ZOOM_STEP = 1.35

/** Input types that don't take typed text, so a focused one must not swallow the boat's keys. */
const KEYLESS_INPUTS = new Set(['range', 'checkbox', 'radio', 'button'])

/** True when the key belongs to a field the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !KEYLESS_INPUTS.has(target.type)
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}

/**
 * Keyboard + on-screen-button input, polled once per frame.
 *  ← / → or A / D : tiller (springs back to centre on release)
 *  ↓ / ↑ or S / W : mainsheet in / out (pulling the sheet down brings the sail in)
 *  Q / E          : vang off / on
 *  Z / X          : cunningham off / on
 *  F / G          : outhaul off / on
 *  C              : cycle camera (chase → sail → top)
 *  + / −          : zoom in / out
 *  R              : reset boat
 */
export function useInput() {
  const held = useRef(new Set<string>())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const key = e.key.toLowerCase()
      held.current.add(key)
      if (key === 'c') {
        const s = useSim.getState()
        s.setCamera(nextCamera(s.camera))
      }
      if (key === 'r') useSim.getState().reset()
      // '=' is + without Shift on most layouts.
      if (key === '+' || key === '=') useSim.getState().zoomBy(KEY_ZOOM_STEP)
      if (key === '-' || key === '_') useSim.getState().zoomBy(1 / KEY_ZOOM_STEP)
      // Also stops a focused slider from stepping on the same arrow press.
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase())
    const blur = () => held.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  return useMemo(
    () => ({
      apply(dt: number) {
        const is = (...keys: string[]) => keys.some((k) => held.current.has(k) || virtualKeys.has(k))
        const s = useSim.getState()
        const port = is('arrowleft', 'a')
        const stbd = is('arrowright', 'd')
        // We expose "turn direction" to the user: left = bow swings to port.
        const target = port && !stbd ? -1 : stbd && !port ? 1 : 0
        const cur = s.boat.tiller
        const rate = target === 0 ? 4 : 3
        const next = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), rate * dt)
        if (next !== cur) s.setTiller(next)

        const sheetRate = 0.45 // full range in ~2.2 s
        if (is('arrowdown', 's')) s.nudgeTrim('mainsheet', sheetRate * dt)
        if (is('arrowup', 'w')) s.nudgeTrim('mainsheet', -sheetRate * dt)
        if (is('e')) s.nudgeTrim('vang', 0.4 * dt)
        if (is('q')) s.nudgeTrim('vang', -0.4 * dt)
        if (is('x')) s.nudgeTrim('cunningham', 0.4 * dt)
        if (is('z')) s.nudgeTrim('cunningham', -0.4 * dt)
        if (is('g')) s.nudgeTrim('outhaul', 0.4 * dt)
        if (is('f')) s.nudgeTrim('outhaul', -0.4 * dt)
      },
    }),
    [],
  )
}
