import type { Derived } from '../sim/types'
import { smoothstep } from '../sim/math'

/** ILCA rig dimensions in boat-local metres (forward = −Z, up = +Y, waterline y = 0). */
export const MAST_Z = -0.82 // mast step ~2.92 m forward of the transom (ILCA class diagram)
export const MAST_FOOT_Y = 0.36 // deck height at the mast step
export const GOOSENECK_Y = 1.15
export const HEAD_Y = 6.1
/** Top of the mast cap, just above the sail head. */
export const MAST_TOP_Y = HEAD_Y + 0.04
export const BOOM_LENGTH = 2.75
export const FOOT = 2.7
/** The head is a corner (just the small head fitting), not a flat top. */
export const HEAD_WIDTH = 0.05
/** Forward bow of the mast at mid-height when fully bent, metres. */
export const MAST_BEND_MAX = 0.3

/** Chord length at height fraction v (0 foot → 1 head). Slightly convex leech. */
export function chordAt(v: number): number {
  return FOOT + (HEAD_WIDTH - FOOT) * Math.pow(v, 0.85)
}

/** Forward (−Z) offset of the mast at a given height from a parabolic bend. */
export function mastBendAt(y: number, bend: number): number {
  const t = (y - MAST_FOOT_Y) / (HEAD_Y - MAST_FOOT_Y)
  return -MAST_BEND_MAX * bend * 4 * t * (1 - t)
}

export interface SailFrame {
  /** Height fraction: 0 foot … 1 head. */
  v: number
  /** Leeward side sign: −1 when the boom is to port. */
  side: number
  /** Chord yaw (boom angle + twist) at height v. */
  phi: number
  /** Elevation of the chord at height v (foot follows the lifted boom). */
  elev: number
  /** Luff point on the (bent) mast. */
  lx: number
  ly: number
  lz: number
  /** Unit chord direction. */
  dx: number
  dy: number
  dz: number
  /** Unit normal toward leeward, horizontal. */
  nx: number
  nz: number
  /** Chord length. */
  c: number
}

/** Everything needed to place points on the sail at height fraction v. */
export function sailFrame(v: number, d: Derived): SailFrame {
  const side = d.twa >= 0 ? -1 : 1
  const phi = d.boomAngle + side * d.twist * v * v
  const elev = d.boomLift * (1 - v)
  const ly = GOOSENECK_Y + (HEAD_Y - GOOSENECK_Y) * v
  const cosE = Math.cos(elev)
  return {
    v,
    side,
    phi,
    elev,
    lx: 0,
    ly,
    lz: MAST_Z + mastBendAt(ly, d.mastBend),
    dx: Math.sin(phi) * cosE,
    dy: Math.sin(elev),
    dz: Math.cos(phi) * cosE,
    nx: side * Math.cos(phi),
    nz: -side * Math.sin(phi),
    c: chordAt(v),
  }
}

/** Camber bulge (metres, toward leeward) at chord fraction u for the given frame. */
export function bulgeAt(u: number, f: SailFrame, d: Derived, time: number): number {
  if (d.luffing) {
    // Flogging: camber collapses into a travelling ripple that fades at the mast, and calms in a
    // ~1 m patch around the clew so the corner stays shackled to the boom without a sharp twist.
    // v is scaled so the patch is roughly round in metres (luff ~1.9× the foot).
    const clewPin = smoothstep(0, 0.35, Math.hypot(1 - u, 1.9 * f.v))
    return 0.12 * f.c * Math.sin(9 * u - 7 * time + 4 * (f.ly - GOOSENECK_Y)) * u * clewPin
  }
  // Peak of sin(π·u^k) sits at u = draftPos.
  const k = Math.log(0.5) / Math.log(d.draftPos)
  return d.camber * f.c * Math.sin(Math.PI * Math.pow(u, k))
}

/** Point on the sail surface at (u, v), written into `out` as [x, y, z]. */
export function sailPoint(u: number, f: SailFrame, bulge: number, out: number[] | Float32Array, o = 0): void {
  out[o] = f.lx + f.dx * u * f.c + f.nx * bulge
  out[o + 1] = f.ly + f.dy * u * f.c
  out[o + 2] = f.lz + f.dz * u * f.c + f.nz * bulge
}
