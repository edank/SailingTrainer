import * as THREE from 'three'

/**
 * ILCA hull, lofted from cross-sections with smooth (Hermite) interpolation between knots.
 * Boat local frame: forward = -Z, starboard = +X, up = +Y, waterline at y = 0.
 */
export const HULL_LENGTH = 4.2
const BOW_Z = -HULL_LENGTH / 2

const STATIONS = 32 // uniform segments along the hull (bow → stern); the cockpit ends are added as extra stations
const RING_POINTS = 17 // points around one half-section (sheer → keel → sheer)

/**
 * [t, halfBeam, keelDepth, sheerHeight] knots along the hull, t = 0 bow → 1 stern.
 * ILCA: 1.37 m beam, ~0.10 m hull-only draft (daggerboard up), 3.81 m waterline. Negative keel depth
 * lifts the ends clear of the water: ~0.34 m at the bow, ~0.1 m at the stern.
 */
const KNOTS: [number, number, number, number][] = [
  [0.0, 0.015, -0.08, 0.25],
  [0.12, 0.26, 0.04, 0.25],
  [0.3, 0.5, 0.09, 0.25],
  [0.5, 0.65, 0.1, 0.25],
  [0.7, 0.69, 0.1, 0.25],
  [0.88, 0.62, 0.08, 0.25],
  [1.0, 0.5, -0.02, 0.25],
]

const WIDEST = KNOTS.reduce((a, b) => (b[1] > a[1] ? b : a))
/** Widest half-beam of the hull, and the sheer (deck-edge) height there. */
export const HULL_HALF_BEAM = WIDEST[1]
export const HULL_SHEER_AT_BEAM = WIDEST[3]

/** Deck crown: how far the centreline stands above the sheer. */
const DECK_CROWN = 0.05
/** Deck cross-section, as fractions of the local half-beam (port → starboard). */
const DECK_FRACTIONS = [-1, -0.94, -0.82, -0.66, -0.55, -0.3, 0, 0.3, 0.55, 0.66, 0.82, 0.94, 1]

/** Self-draining footwell: ~1.0 m long, aft end ~0.7 m from the transom (ILCA class diagram). */
export const COCKPIT_AFT_Z = HULL_LENGTH / 2 - 0.7
export const COCKPIT_FWD_Z = COCKPIT_AFT_Z - 1.0
/** Cockpit sides sit at this fraction of the half-beam (~0.37 m off the centreline). */
const COCKPIT_FRACTION = 0.55
export const COCKPIT_FLOOR_Y = 0.12

/** Material groups of the hull geometry, in order. */
export const HULL_GROUPS = { hull: 0, deck: 1, cockpit: 2 } as const

const tAt = (z: number) => (z - BOW_Z) / HULL_LENGTH

/** Cubic Hermite through the knots (finite-difference tangents): smooth, and passes through every knot. */
function sample(t: number): { w: number; d: number; s: number } {
  const n = KNOTS.length
  let i = 1
  while (i < n - 1 && t > KNOTS[i][0]) i++
  const k0 = KNOTS[i - 1]
  const k1 = KNOTS[i]
  const h = k1[0] - k0[0]
  const u = Math.min(1, Math.max(0, (t - k0[0]) / h))
  const slope = (j: number, c: number) => {
    const a = KNOTS[Math.max(0, j - 1)]
    const b = KNOTS[Math.min(n - 1, j + 1)]
    return (b[c] - a[c]) / (b[0] - a[0])
  }
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1
  const h10 = u ** 3 - 2 * u ** 2 + u
  const h01 = -2 * u ** 3 + 3 * u ** 2
  const h11 = u ** 3 - u ** 2
  const f = (c: number) => h00 * k0[c] + h10 * h * slope(i - 1, c) + h01 * k1[c] + h11 * h * slope(i, c)
  return { w: f(1), d: f(2), s: f(3) }
}

/** Deck surface height at a fraction of the half-beam (0 = centreline, ±1 = sheer). */
function deckY(s: number, f: number): number {
  return s + DECK_CROWN * (1 - f * f)
}

export function buildHull(): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const g = new THREE.BufferGeometry()
  const vert = (x: number, y: number, z: number) => (pos.push(x, y, z), pos.length / 3 - 1)
  /** Flat quad with its own vertices, wound so its normal points along `want`. */
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, want: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a))
    const [p, q, r, s] = [a, b, c, d].map((v) => vert(v.x, v.y, v.z))
    if (n.dot(want) >= 0) idx.push(p, q, s, q, r, s)
    else idx.push(p, s, q, q, s, r)
  }
  let groupStart = 0
  const endGroup = (material: number) => {
    g.addGroup(groupStart, idx.length - groupStart, material)
    groupStart = idx.length
  }

  const ts = new Set<number>()
  for (let i = 0; i <= STATIONS; i++) ts.add(i / STATIONS)
  ts.add(tAt(COCKPIT_FWD_Z))
  ts.add(tAt(COCKPIT_AFT_Z))
  const stations = [...ts].sort((a, b) => a - b)
  const last = stations.length - 1

  // Hull skin.
  const ringStart: number[] = []
  for (const t of stations) {
    const { w, d, s } = sample(t)
    const z = BOW_Z + t * HULL_LENGTH
    ringStart.push(pos.length / 3)
    for (let j = 0; j < RING_POINTS; j++) {
      const a = (j / (RING_POINTS - 1)) * Math.PI // 0 = stbd sheer, π/2 = keel, π = port sheer
      // sin^0.45 flattens the bottom so it reads as a planing dinghy, not a canoe.
      vert(w * Math.cos(a), s - (s + d) * Math.pow(Math.sin(a), 0.45), z)
    }
  }
  for (let i = 0; i < last; i++) {
    const a = ringStart[i]
    const b = ringStart[i + 1]
    for (let j = 0; j < RING_POINTS - 1; j++) idx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1)
  }

  // Transom: flat fan across the last ring, with its own vertices so it gets a crisp edge.
  {
    const { w, d, s } = sample(1)
    const z = HULL_LENGTH / 2
    const c = vert(0, (s - d) / 2, z)
    const rim: number[] = []
    for (let j = 0; j < RING_POINTS; j++) {
      const a = (j / (RING_POINTS - 1)) * Math.PI
      rim.push(vert(w * Math.cos(a), s - (s + d) * Math.pow(Math.sin(a), 0.45), z))
    }
    for (const f of DECK_FRACTIONS) rim.push(vert(f * w, deckY(s, f), z)) // port → stbd closes the loop over the deck
    for (let j = 0; j < rim.length - 1; j++) idx.push(rim[j + 1], rim[j], c)
  }
  endGroup(HULL_GROUPS.hull)

  // Deck: crowned grid, with the cockpit cut out. Face up: (P00, P10, P11) is CCW seen from +Y.
  const cols = DECK_FRACTIONS.length
  const deckStart = pos.length / 3
  for (const t of stations) {
    const { w, s } = sample(t)
    for (const f of DECK_FRACTIONS) vert(f * w, deckY(s, f), BOW_Z + t * HULL_LENGTH)
  }
  const tFwd = tAt(COCKPIT_FWD_Z)
  const tAft = tAt(COCKPIT_AFT_Z)
  const inCockpit = (i: number, k: number) =>
    stations[i] >= tFwd - 1e-9 && stations[i + 1] <= tAft + 1e-9 && Math.abs(DECK_FRACTIONS[k]) < COCKPIT_FRACTION + 1e-9 && Math.abs(DECK_FRACTIONS[k + 1]) < COCKPIT_FRACTION + 1e-9
  for (let i = 0; i < last; i++) {
    for (let k = 0; k < cols - 1; k++) {
      if (inCockpit(i, k)) continue
      const p00 = deckStart + i * cols + k
      const p01 = p00 + 1
      const p10 = p00 + cols
      const p11 = p10 + 1
      idx.push(p00, p10, p11, p00, p11, p01)
    }
  }
  endGroup(HULL_GROUPS.deck)

  // Cockpit well: walls drop from the edge of the deck cut-out to a flat floor.
  const deckPoint = (t: number, f: number, y?: number) => {
    const { w, s } = sample(t)
    return new THREE.Vector3(f * w, y ?? deckY(s, f), BOW_Z + t * HULL_LENGTH)
  }
  const inner = DECK_FRACTIONS.filter((f) => Math.abs(f) <= COCKPIT_FRACTION + 1e-9)
  const aft = new THREE.Vector3(0, 0, 1)
  const fwd = new THREE.Vector3(0, 0, -1)
  for (let k = 0; k < inner.length - 1; k++) {
    const [f0, f1] = [inner[k], inner[k + 1]]
    quad(deckPoint(tFwd, f0), deckPoint(tFwd, f1), deckPoint(tFwd, f1, COCKPIT_FLOOR_Y), deckPoint(tFwd, f0, COCKPIT_FLOOR_Y), aft)
    quad(deckPoint(tAft, f0), deckPoint(tAft, f1), deckPoint(tAft, f1, COCKPIT_FLOOR_Y), deckPoint(tAft, f0, COCKPIT_FLOOR_Y), fwd)
  }
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < last; i++) {
    const [t0, t1] = [stations[i], stations[i + 1]]
    if (t0 < tFwd - 1e-9 || t1 > tAft + 1e-9) continue
    for (const side of [-1, 1]) {
      const f = side * COCKPIT_FRACTION
      const inward = new THREE.Vector3(-side, 0, 0)
      quad(deckPoint(t0, f), deckPoint(t1, f), deckPoint(t1, f, COCKPIT_FLOOR_Y), deckPoint(t0, f, COCKPIT_FLOOR_Y), inward)
    }
    quad(deckPoint(t0, -COCKPIT_FRACTION, COCKPIT_FLOOR_Y), deckPoint(t0, COCKPIT_FRACTION, COCKPIT_FLOOR_Y), deckPoint(t1, COCKPIT_FRACTION, COCKPIT_FLOOR_Y), deckPoint(t1, -COCKPIT_FRACTION, COCKPIT_FLOOR_Y), up)
  }
  endGroup(HULL_GROUPS.cockpit)

  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Points along one sheer line (deck edge), bow → stern, for the gunwale rubbing strip. side: +1 starboard, −1 port. */
export function sheerLine(side: number, n = 40): THREE.Vector3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const { w, s } = sample(t)
    return new THREE.Vector3(side * w, s, BOW_Z + t * HULL_LENGTH)
  })
}

/** Deck height on the centreline at a given boat-local z (for placing fittings). */
export function deckHeightAtZ(z: number): number {
  return sample(tAt(z)).s + DECK_CROWN
}
