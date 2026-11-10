import { useEffect, useMemo, useRef } from 'react'
import { nextCamera, useSim } from '../store'

/** On-screen buttons write key names here; polled alongside the real keyboard. */
export const virtualKeys = new Set<string>()

/**
 * Keyboard + on-screen-button input, polled once per frame.
 *  ← / → or A / D : tiller (springs back to centre on release)
 *  ↑ / ↓ or W / S : mainsheet in / out
 *  Q / E          : vang off / on
 *  C              : cycle camera (chase → sail → top)
 *  R              : reset boat
 */
export function useInput() {
  const held = useRef(new Set<string>())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      const key = e.key.toLowerCase()
      held.current.add(key)
      if (key === 'c') {
        const s = useSim.getState()
        s.setCamera(nextCamera(s.camera))
      }
      if (key === 'r') useSim.getState().reset()
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
        if (is('arrowup', 'w')) s.nudgeTrim('mainsheet', sheetRate * dt)
        if (is('arrowdown', 's')) s.nudgeTrim('mainsheet', -sheetRate * dt)
        if (is('e')) s.nudgeTrim('vang', 0.4 * dt)
        if (is('q')) s.nudgeTrim('vang', -0.4 * dt)
      },
    }),
    [],
  )
}
