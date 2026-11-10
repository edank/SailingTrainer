/** Points of sail, ordered from head-to-wind to dead downwind. */
export type PointOfSail =
  | 'in-irons'
  | 'close-hauled'
  | 'close-reach'
  | 'beam-reach'
  | 'broad-reach'
  | 'run'

export interface PointOfSailInfo {
  id: PointOfSail
  name: string
  /** True wind angle range in degrees (absolute, 0 = head to wind, 180 = dead downwind). */
  twaRange: [number, number]
  /** 1–2 sentences: what this point of sail is. */
  summary: string
  /** How to trim the ILCA here — mainsheet, vang, outhaul, cunningham, body weight. */
  trimTips: string
  /** Common beginner mistake on this point of sail. */
  commonMistake: string
}

/** The four sail controls on an ILCA (Laser) plus the tiller. */
export type ControlId = 'tiller' | 'mainsheet' | 'vang' | 'cunningham' | 'outhaul'

export interface ControlInfo {
  id: ControlId
  name: string
  /** Alternate names sailors use (e.g. "kicker" for vang). */
  aka?: string[]
  /** One sentence: what the rope physically does to the sail/boat. */
  whatItDoes: string
  /** When to pull it on vs. ease it, in plain language. */
  whenToUse: string
}

export interface BasicRule {
  /** Racing Rules of Sailing number, e.g. 10. */
  rrs: number
  title: string
  /** Plain-language explanation for beginners (2–3 sentences). */
  plain: string
  /** A concrete on-the-water example. */
  example: string
}
