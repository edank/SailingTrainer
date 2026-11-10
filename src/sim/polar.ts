import { DEG, KNOTS_TO_MS, clamp, lerp } from './math'

/**
 * Simplified ILCA polar: max boat speed (m/s) for a given |TWA| and true wind speed.
 * Shape is hand-tuned to feel right, not measured data: zero inside the no-go zone,
 * fastest on a broad reach, a little slower dead downwind, and capped near hull speed
 * (~5 kn) except when planing-ish on a reach in breeze.
 */
export function polarSpeed(twaAbs: number, windSpeed: number): number {
  const twaDeg = Math.abs(twaAbs) / DEG
  // Angle factor 0…1 — piecewise-linear through tuned knots.
  const knots: [number, number][] = [
    [0, 0],
    [30, 0],
    [40, 0.72],
    [50, 0.85],
    [70, 0.95],
    [90, 1.0],
    [110, 1.05],
    [140, 1.0],
    [165, 0.9],
    [180, 0.85],
  ]
  let f = 0
  for (let i = 1; i < knots.length; i++) {
    const [a0, f0] = knots[i - 1]
    const [a1, f1] = knots[i]
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
