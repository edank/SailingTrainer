/**
 * Coordinate conventions (right-handed, Y up — matches three.js):
 *   +X = east, +Z = south, -Z = north.
 *   Heading 0 = north (-Z), increasing clockwise when viewed from above.
 *   Wind direction is the compass bearing the wind blows FROM, same convention.
 *   Angles in radians internally; degrees only at the UI boundary.
 */

export interface Wind {
  /** Bearing the true wind blows from, radians, 0 = from north. */
  fromDir: number
  /** True wind speed in m/s. */
  speed: number
}

/** All four sail controls, each normalised 0 (fully eased) → 1 (fully on). */
export interface Trim {
  mainsheet: number
  vang: number
  cunningham: number
  outhaul: number
}

export interface BoatState {
  x: number
  z: number
  /** Compass heading, radians. */
  heading: number
  /** Boat speed through the water, m/s. */
  speed: number
  /** Heel angle, radians. Positive = heeling to starboard. */
  heel: number
  /** Tiller input, -1 (full port = turn to port) … +1 (full starboard). */
  tiller: number
  trim: Trim
}

/** Derived quantities recomputed every step — read-only for the UI and scene. */
export interface Derived {
  /** True wind angle relative to the bow, radians, signed: +ve = wind over starboard side. */
  twa: number
  /** Apparent wind angle, same sign convention. */
  awa: number
  /** Apparent wind speed, m/s. */
  aws: number
  /** Angle the boom makes with the centreline, radians, signed (+ve = boom out to starboard). */
  boomAngle: number
  /**
   * Geometric angle between apparent wind and boom, radians, unsigned. Not a verdict on sail state:
   * `luffing` is authoritative (e.g. in irons the sail luffs even when this angle looks healthy).
   */
  aoa: number
  /** 0…1 how well the sail is trimmed overall (drives speed and telltales). */
  trimEfficiency: number
  /** Twist of the leech at the head, radians, from vang (mostly) and cunningham. */
  twist: number
  /** How far the boom end rises above horizontal, radians. Vang + sheet hold it down. */
  boomLift: number
  /** Mast bend 0…1 (fraction of max), driven by vang and mainsheet tension. */
  mastBend: number
  /** Sail camber depth as fraction of chord, from outhaul/cunningham. */
  camber: number
  /** Position of max draft along the chord 0…1, from cunningham. */
  draftPos: number
  /** True if the sail is flogging (no drive). */
  luffing: boolean
  /** Pointing inside the no-go zone: no trim makes the sail work, the boat must bear away. */
  inIrons: boolean
  /** Best setting of each control for the current wind angle and strength. */
  idealTrim: Trim
  /** Per-control hint: -1 = ease it, 0 = good, +1 = pull on. */
  hints: { mainsheet: number; vang: number; cunningham: number; outhaul: number }
  /** Telltale state on windward and leeward sides. */
  telltales: { windward: TelltaleState; leeward: TelltaleState }
  /** Max achievable boat speed at this TWA and wind, m/s (for the "target" readout). */
  polarSpeed: number
  /** Which tack: 'starboard' when wind is over the starboard side. */
  tack: 'port' | 'starboard'
}

export type TelltaleState = 'flowing' | 'lifting' | 'stalled'
