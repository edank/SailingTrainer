import type { BoatState, Derived, TelltaleState, Trim, Wind } from './types'
import { DEG, approach, clamp, lerp, smoothstep, wrapPi } from './math'
import { polarSpeed } from './polar'

/** Max boom angle when the mainsheet is fully eased. */
const BOOM_MAX = 85 * DEG
/** Angle of attack where the sail reaches full lift; it stays there until AOA_PLATEAU_END. */
const AOA_BEST = 14 * DEG
const AOA_PLATEAU_END = 28 * DEG
/** Beyond this the flow separates and the sail stalls. */
const AOA_STALL = 40 * DEG
/** Centre of the sweet spot — what the mainsheet hint aims for. */
const AOA_TARGET = 21 * DEG
/** Heel per unit of sail force × side factor, and the most the boat ever heels. */
const HEEL_GAIN = 24 * DEG
const MAX_HEEL = 28 * DEG

export const DEFAULT_TRIM: Trim = { mainsheet: 0.5, vang: 0.4, cunningham: 0.2, outhaul: 0.4 }

export function initialBoat(): BoatState {
  return { x: 0, z: 0, heading: 90 * DEG, speed: 1, heel: 0, tiller: 0, trim: { ...DEFAULT_TRIM } }
}

/**
 * Lift-style curve of sail effectiveness vs angle of attack (unsigned, radians).
 * 0 when luffing, rises to 1 at AOA_BEST, falls off past the stall.
 */
function sailEfficiency(aoa: number): number {
  if (aoa <= 0) return 0
  if (aoa <= AOA_BEST) return smoothstep(0, AOA_BEST, aoa)
  if (aoa <= AOA_PLATEAU_END) return 1
  if (aoa <= AOA_STALL) return lerp(1, 0.55, smoothstep(AOA_PLATEAU_END, AOA_STALL, aoa))
  // Deep stall — still some drag-driven push, which is why running works at all.
  return lerp(0.55, 0.45, smoothstep(AOA_STALL, 90 * DEG, aoa))
}

function telltale(aoa: number, luffing: boolean): { windward: TelltaleState; leeward: TelltaleState } {
  if (luffing || aoa < AOA_BEST * 0.7) return { windward: 'lifting', leeward: 'flowing' }
  if (aoa > AOA_PLATEAU_END + 4 * DEG) return { windward: 'flowing', leeward: 'stalled' }
  return { windward: 'flowing', leeward: 'flowing' }
}

/**
 * Hint sign for a control given its current and ideal value.
 * +1 = pull on, -1 = ease, 0 = close enough.
 */
function hint(current: number, ideal: number, tolerance = 0.15): number {
  const d = ideal - current
  return Math.abs(d) < tolerance ? 0 : Math.sign(d)
}

export function derive(b: BoatState, wind: Wind): Derived {
  // --- True wind angle (signed; +ve = wind over starboard) ---
  const twa = wrapPi(wind.fromDir - b.heading)
  const twaAbs = Math.abs(twa)

  // --- Apparent wind: true wind vector + (−boat velocity), in boat frame ---
  // Boat frame: +fwd along bow, +stbd to the right. True wind blows *toward* bearing fromDir+π.
  const twFwd = -wind.speed * Math.cos(twa) // wind from ahead → negative fwd component
  const twStbd = -wind.speed * Math.sin(twa) // wind from stbd → blows toward port (negative)
  const awFwd = twFwd - b.speed
  const awStbd = twStbd
  const aws = Math.hypot(awFwd, awStbd)
  // Bearing the apparent wind comes FROM, relative to bow.
  const awa = Math.atan2(-awStbd, -awFwd)
  const awaAbs = Math.abs(awa)
  const tack = twa >= 0 ? 'starboard' : 'port'
  const leewardSign = twa >= 0 ? -1 : 1 // boom goes to leeward (opposite the wind)

  // --- Sail geometry from controls ---
  // Mainsheet limits how far the boom can swing; the wind pushes it to that limit.
  const sheetLimit = (1 - b.trim.mainsheet) * BOOM_MAX
  // If the sheet lets the boom out past the apparent wind, the sail just weathercocks → luffing.
  const boomAbs = Math.min(sheetLimit, awaAbs)
  const boomAngle = leewardSign * boomAbs
  const aoa = awaAbs - boomAbs // 0 ⇒ boom has weathercocked to the wind ⇒ luffing
  const luffing = aoa <= 0.5 * DEG

  // The sheet also pulls the boom down when it's nearly in; eased, only the vang holds it.
  const sheetHold = clamp((b.trim.mainsheet - 0.6) / 0.4, 0, 1)
  const holdDown = clamp(b.trim.vang + sheetHold * (1 - b.trim.vang) * 0.8, 0, 1)
  // Vang: tight = little twist. Twist at head up to ~28° when fully eased;
  // cunningham opens the upper leech a few degrees more.
  const twist = (1 - holdDown) * 28 * DEG + b.trim.cunningham * 5 * DEG
  // Boom skies up to ~22° when nothing holds it down.
  const boomLift = (1 - holdDown) * 22 * DEG
  // Vang compresses and bends the mast; a hard sheet adds a little.
  const mastBend = clamp(0.85 * b.trim.vang + 0.25 * sheetHold, 0, 1)
  // Outhaul + cunningham + mast bend flatten the sail. Camber 5% (flat) … 16% (full).
  const camber = lerp(0.16, 0.05, clamp(0.5 * b.trim.outhaul + 0.3 * b.trim.cunningham + 0.2 * mastBend, 0, 1))
  // Cunningham pulls the draft forward: 52% (eased) → 32% (hard on).
  const draftPos = lerp(0.52, 0.32, b.trim.cunningham)

  // --- Ideal settings for the current conditions (drive hints + secondary efficiency) ---
  const upwind = twaAbs < 70 * DEG
  const downwind = twaAbs > 130 * DEG
  const breeze = clamp((wind.speed - 4) / 8, 0, 1) // 0 light … 1 breezy (≥12 m/s)
  const idealVang = upwind ? lerp(0.45, 0.9, breeze) : downwind ? 0.55 : lerp(0.35, 0.7, breeze)
  const idealOuthaul = upwind ? lerp(0.35, 0.85, breeze) : lerp(0.15, 0.5, breeze)
  const idealCunningham = upwind ? lerp(0.05, 0.85, breeze) : lerp(0.0, 0.3, breeze)
  // Ideal sheet: whatever puts the boom at awa − AOA_TARGET (capped by BOOM_MAX).
  const idealBoom = clamp(awaAbs - AOA_TARGET, 0, BOOM_MAX)
  const idealMainsheet = 1 - idealBoom / BOOM_MAX

  const primary = sailEfficiency(aoa)
  const secondary =
    1 -
    0.25 * Math.abs(b.trim.vang - idealVang) -
    0.15 * Math.abs(b.trim.outhaul - idealOuthaul) -
    0.1 * Math.abs(b.trim.cunningham - idealCunningham)
  const trimEfficiency = clamp(primary * secondary, 0, 1)

  return {
    twa,
    awa,
    aws,
    boomAngle,
    aoa,
    trimEfficiency,
    twist,
    boomLift,
    mastBend,
    camber,
    draftPos,
    luffing,
    tack,
    polarSpeed: polarSpeed(twaAbs, wind.speed),
    telltales: telltale(aoa, luffing),
    hints: {
      mainsheet: hint(b.trim.mainsheet, idealMainsheet, 0.05),
      vang: hint(b.trim.vang, idealVang),
      cunningham: hint(b.trim.cunningham, idealCunningham),
      outhaul: hint(b.trim.outhaul, idealOuthaul),
    },
  }
}

/** Advance the boat by dt seconds. Mutates and returns `b`; also returns the derived values used. */
export function step(b: BoatState, wind: Wind, dt: number): Derived {
  const d = derive(b, wind)
  const twaAbs = Math.abs(d.twa)

  // --- Speed: relax toward polar × trim efficiency. Slow to accelerate, quicker to decelerate. ---
  const target = d.polarSpeed * d.trimEfficiency
  const tau = target > b.speed ? 2.5 : 1.5
  b.speed = approach(b.speed, target, tau, dt)
  // Head-to-wind drifts to a stop regardless of trim.
  if (twaAbs < 30 * DEG) b.speed = approach(b.speed, 0, 2.0, dt)

  // --- Steering: rudder authority grows with speed; a little even when stopped (sculling-ish). ---
  const turnRate = (0.25 + 0.3 * b.speed) * b.tiller // rad/s
  b.heading += turnRate * dt

  // --- Heel: proportional to sail force × side component. Leeward side goes down. ---
  const sideFactor = Math.sin(twaAbs) * (twaAbs < 120 * DEG ? 1 : clamp((Math.PI - twaAbs) / (60 * DEG), 0, 1))
  const force = d.trimEfficiency * (d.aws / 8) ** 2
  const heelTarget = -Math.sign(d.twa) * clamp(HEEL_GAIN * force * Math.sqrt(Math.max(sideFactor, 0.15)), 0, MAX_HEEL)
  b.heel = approach(b.heel, heelTarget, 0.8, dt)

  // --- Position: heading 0 = north = -Z, clockwise positive. Add a touch of leeway upwind. ---
  const leeway = upwindLeeway(twaAbs) * Math.sign(-d.twa) // slips to leeward
  const course = b.heading + leeway
  b.x += Math.sin(course) * b.speed * dt
  b.z += -Math.cos(course) * b.speed * dt

  return d
}

function upwindLeeway(twaAbs: number): number {
  return twaAbs < 90 * DEG ? 4 * DEG * (1 - twaAbs / (90 * DEG)) : 0
}
