export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Wrap an angle in radians to (-π, π]. */
export function wrapPi(a: number): number {
  a = (a + Math.PI) % (2 * Math.PI)
  if (a < 0) a += 2 * Math.PI
  return a - Math.PI
}

/** Wrap an angle in radians to [0, 2π). */
export function wrapTwoPi(a: number): number {
  a %= 2 * Math.PI
  return a < 0 ? a + 2 * Math.PI : a
}

/** Exponential approach of `current` toward `target` with time constant `tau` seconds. */
export function approach(current: number, target: number, tau: number, dt: number): number {
  const k = 1 - Math.exp(-dt / tau)
  return current + (target - current) * k
}

/** Smoothstep on [e0, e1]. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const KNOTS_TO_MS = 0.514444
export const MS_TO_KNOTS = 1 / KNOTS_TO_MS
