import { DEG, KNOTS_TO_MS, clamp, lerp } from './math'

/** Inside this |TWA| the sail cannot fill: the boat is in irons. */
export const NO_GO_DEG = 40

/** [|TWA| degrees, speed factor 0…1]. The ramp out of the no-go zone moves with NO_GO_DEG. */
const ANGLE_KNOTS: [number, number][] = [
  [0, 0],
  [NO_GO_DEG, 0],
  [NO_GO_DEG + 5, 0.75],
  [NO_GO_DEG + 10, 0.85],
  [70, 0.95],
  [90, 1.0],
  [110, 1.05],
  [140, 1.0],
  [165, 0.9],
  [180, 0.85],
]
// Interpolation needs strictly increasing angles (fails if NO_GO_DEG is tuned to 60° or more).
if (ANGLE_KNOTS.some(([a], i) => i > 0 && a <= ANGLE_KNOTS[i - 1][0])) {
  throw new Error('polar ANGLE_KNOTS angles must strictly increase')
}

/**
 * Simplified ILCA polar: max boat speed (m/s) for a given |TWA| and true wind speed.
 * Shape is hand-tuned to feel right, not measured data: zero inside the no-go zone,
 * fastest on a broad reach, a little slower dead downwind, and capped near hull speed
 * (~5 kn) except when planing-ish on a reach in breeze.
 */
export function polarSpeed(twaAbs: number, windSpeed: number): number {
  const twaDeg = Math.abs(twaAbs) / DEG
  // Angle factor 0…1 — piecewise-linear through tuned knots.
  let f = 0
  for (let i = 1; i < ANGLE_KNOTS.length; i++) {
    const [a0, f0] = ANGLE_KNOTS[i - 1]
    const [a1, f1] = ANGLE_KNOTS[i]
    if (twaDeg <= a1) {
      f = lerp(f0, f1, (twaDeg - a0) / (a1 - a0))
      break
    }
  }
  // Wind factor: ~0.5·TWS in light air, flattening toward hull speed.
  const hull = 5.0 * KNOTS_TO_MS
  const raw = 0.55 * windSpeed
  const windFactor = hull * (1 - Math.exp(-raw / hull))
  // Allow a touch above hull speed when reaching in breeze (planing hint).
  const planing = twaDeg > 80 && twaDeg < 150 ? clamp((windSpeed - 6) / 10, 0, 1) * 0.35 : 0
  return windFactor * f * (1 + planing)
}
