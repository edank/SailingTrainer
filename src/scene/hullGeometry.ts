import * as THREE from 'three'
import { lerp } from '../sim/math'

/**
 * Low-poly ILCA-ish hull, lofted from cross-sections.
 * Boat local frame: forward = -Z, starboard = +X, up = +Y, waterline at y = 0.
 */
export const HULL_LENGTH = 4.2
const BOW_Z = -HULL_LENGTH / 2

const STATIONS = 14 // Number of segments along the hull; the hull is lofted from STATIONS + 1 evenly spaced cross-sections (bow → stern).
const RING_POINTS = 11 // points around one half-section (sheer → keel → sheer)

/** [t, halfBeam, keelDepth, sheerHeight] knots along the hull, t = 0 bow → 1 stern. */
const KNOTS: [number, number, number, number][] = [
  [0.0, 0.015, 0.05, 0.46],
  [0.12, 0.26, 0.13, 0.4],
  [0.3, 0.5, 0.19, 0.34],
  [0.5, 0.65, 0.22, 0.31],
  [0.7, 0.69, 0.21, 0.29],
  [0.88, 0.62, 0.16, 0.29],
  [1.0, 0.5, 0.1, 0.3],
]

function sample(t: number): { w: number; d: number; s: number } {
  for (let i = 1; i < KNOTS.length; i++) {
    const [t0, w0, d0, s0] = KNOTS[i - 1]
    const [t1, w1, d1, s1] = KNOTS[i]
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0)
      return { w: lerp(w0, w1, k), d: lerp(d0, d1, k), s: lerp(s0, s1, k) }
    }
  }
  const [, w, d, s] = KNOTS[KNOTS.length - 1]
  return { w, d, s }
}

export function buildHull(): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const ringStart: number[] = []

  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS
    const { w, d, s } = sample(t)
    const z = BOW_Z + t * HULL_LENGTH
    ringStart.push(pos.length / 3)
    for (let j = 0; j < RING_POINTS; j++) {
      const a = (j / (RING_POINTS - 1)) * Math.PI // 0 = stbd sheer, π/2 = keel, π = port sheer
      const x = w * Math.cos(a)
      // sin^0.6 flattens the bottom so it reads as a dinghy, not a canoe.
      const y = s - (s + d) * Math.pow(Math.sin(a), 0.6)
      pos.push(x, y, z)
    }
  }

  // Hull skin.
  for (let i = 0; i < STATIONS; i++) {
    const a = ringStart[i]
    const b = ringStart[i + 1]
    for (let j = 0; j < RING_POINTS - 1; j++) {
      idx.push(a + j, b + j, a + j + 1)
      idx.push(a + j + 1, b + j, b + j + 1)
    }
  }

  // Deck: slight camber up the centreline, fan from each station's sheer points.
  const deckStart = pos.length / 3
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS
    const { s } = sample(t)
    pos.push(0, s + 0.05, BOW_Z + t * HULL_LENGTH)
  }
  for (let i = 0; i < STATIONS; i++) {
    const sS0 = ringStart[i] // stbd sheer this station
    const sS1 = ringStart[i + 1]
    const pS0 = ringStart[i] + RING_POINTS - 1 // port sheer
    const pS1 = ringStart[i + 1] + RING_POINTS - 1
    const c0 = deckStart + i
    const c1 = deckStart + i + 1
    // Face up: counter-clockwise when viewed from +Y (screen right = +X, screen up = −Z).
    idx.push(sS0, c1, sS1, sS0, c0, c1)
    idx.push(c0, pS1, c1, c0, pS0, pS1)
  }

  // Transom: fan across the last ring.
  const last = ringStart[STATIONS]
  const tc = pos.length / 3
  const { d, s } = sample(1)
  pos.push(0, (s - d) / 2, BOW_Z + HULL_LENGTH)
  for (let j = 0; j < RING_POINTS - 1; j++) idx.push(last + j + 1, last + j, tc)
  idx.push(last, deckStart + STATIONS, tc)
  idx.push(deckStart + STATIONS, last + RING_POINTS - 1, tc)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Deck height at a given fraction along the hull (for placing fittings). */
export function deckHeightAt(t: number): number {
  return sample(t).s + 0.05
}
