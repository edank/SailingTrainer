import { create } from 'zustand'
import type { BoatState, Derived, Trim, Wind } from './sim/types'
import { derive, idealTrimFor, initialBoat, step } from './sim/boat'
import { DEG } from './sim/math'
import { isPhone } from './hooks/useIsPhone'

export type CameraMode = 'chase' | 'sail' | 'top'
export const CAMERA_ORDER: CameraMode[] = ['chase', 'sail', 'top']
export const CAMERA_LABEL: Record<CameraMode, string> = { chase: 'Chase', sail: 'Sail view', top: 'Top view' }
export const nextCamera = (c: CameraMode): CameraMode => CAMERA_ORDER[(CAMERA_ORDER.indexOf(c) + 1) % CAMERA_ORDER.length]
export type Panel = 'lesson' | 'controls' | 'rules' | null
/** Camera zoom range: magnification over each view's default framing (2 = half the distance). */
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3

interface State {
  wind: Wind
  boat: BoatState
  derived: Derived
  camera: CameraMode
  /** Magnification over the camera's default framing; 1 = default. */
  zoom: number
  panel: Panel
  paused: boolean
  /** Keep every control at its ideal setting each step. Any manual trim change turns it off. */
  autoTrim: boolean

  tick: (dt: number) => void
  setTiller: (v: number) => void
  setTrim: (k: keyof Trim, v: number) => void
  nudgeTrim: (k: keyof Trim, dv: number) => void
  /** One-off: set every control to its ideal for the current conditions. */
  applyIdealTrim: () => void
  setAutoTrim: (on: boolean) => void
  setWind: (w: Partial<Wind>) => void
  setCamera: (c: CameraMode) => void
  /** Multiply the zoom by `factor` (> 1 zooms in), clamped to ZOOM_MIN…ZOOM_MAX. */
  zoomBy: (factor: number) => void
  setPanel: (p: Panel) => void
  reset: () => void
}

const initialWind: Wind = { fromDir: 0, speed: 6 }

export const useSim = create<State>((set, get) => ({
  wind: initialWind,
  boat: initialBoat(),
  derived: derive(initialBoat(), initialWind),
  camera: 'chase',
  zoom: 1,
  // Phones start with the lesson sheet closed so the boat is visible.
  panel: isPhone() ? null : 'lesson',
  paused: false,
  autoTrim: false,

  tick: (dt) => {
    const { boat, wind, paused, autoTrim } = get()
    if (paused) return
    if (autoTrim) boat.trim = idealTrimFor(boat, wind)
    // Mutate in place for perf, then publish a shallow copy so subscribers re-render.
    const derived = step(boat, wind, Math.min(dt, 0.05))
    set({ boat: { ...boat }, derived })
  },
  setTiller: (v) => set((s) => ({ boat: { ...s.boat, tiller: Math.max(-1, Math.min(1, v)) } })),
  setTrim: (k, v) =>
    set((s) => ({ autoTrim: false, boat: { ...s.boat, trim: { ...s.boat.trim, [k]: Math.max(0, Math.min(1, v)) } } })),
  nudgeTrim: (k, dv) => get().setTrim(k, get().boat.trim[k] + dv),
  applyIdealTrim: () => set((s) => ({ boat: { ...s.boat, trim: idealTrimFor(s.boat, s.wind) } })),
  setAutoTrim: (autoTrim) => set({ autoTrim }),
  setWind: (w) => set((s) => ({ wind: { ...s.wind, ...w } })),
  setCamera: (camera) => set({ camera }),
  zoomBy: (factor) => set((s) => ({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.zoom * factor)) })),
  setPanel: (panel) => set({ panel }),
  reset: () => set({ boat: initialBoat() }),
}))

// Dev-only handle for poking the sim from the browser console.
if (import.meta.env.DEV) (window as unknown as { __sim: typeof useSim }).__sim = useSim

/** Convenience selectors in degrees for UI. */
export const toDeg = (r: number) => Math.round(r / DEG)
