import * as THREE from 'three'
import { chordAt, FOOT, GOOSENECK_Y, HEAD_WIDTH, HEAD_Y } from './sailGeometry'

/**
 * Sail cloth artwork, drawn once on a canvas in metres: x = distance aft of the luff (0 … FOOT),
 * y = height above the foot (0 … LUFF). The sail mesh's UVs use the same metric mapping.
 */
const LUFF = HEAD_Y - GOOSENECK_Y
type Pt = [number, number]
const PX = 200 // canvas pixels per metre
const W = Math.round(FOOT * PX)
const H = Math.round(LUFF * PX)

const CLOTH = '#f4f1e8'
const SEAM = 'rgba(120, 110, 90, 0.35)'
const PATCH = 'rgba(150, 140, 115, 0.12)'
const BATTEN = 'rgba(70, 66, 55, 0.7)'
/** Clear film: reads darker than the cloth because you see the sky/water through it. */
const WINDOW = 'rgba(95, 120, 140, 0.55)'
/** ILCA mark: letters red on top, grey below the split. */
const INSIGNIA_TOP = '#d2232a'
const INSIGNIA_BOTTOM = '#8a8d91'
/** Batten pockets: [height fraction on the leech, length m]; ILCA has three, the top one shorter. */
const BATTENS: [number, number][] = [
  [0.28, 0.72],
  [0.52, 0.72],
  [0.76, 0.48],
]
/** Radial cut: panels fan out from the clew below this cross seam (at the middle batten) and from the head above it. */
const JOIN_V = BATTENS[1][0]
const CLEW_RADIALS = 9
const HEAD_RADIALS = 6
/** Battens (and everything lined up with them) drop this far below horizontal toward the luff. */
const BATTEN_TILT = 12 * THREE.MathUtils.DEG2RAD
/** Clear window in the lower luff panel: lower forward corner [x, y] and [length, height] in metres; a rectangle square to the battens. */
const WINDOW_AT: Pt = [0.3, 0.5]
const WINDOW_SIZE: Pt = [0.9, 0.5]
/** Reinforcement patches at head, tack and clew: [x, y, outer radius m]; rings at these fractions of it, stitched radially. */
const CORNERS: [number, number, number][] = [
  [HEAD_WIDTH / 2, LUFF, 0.5],
  [0, 0, 0.42],
  [FOOT, 0, 0.42],
]
const CORNER_RINGS = [1, 0.7, 0.45]
const CORNER_RADIALS = 36
/** The ILCA mark sits above the top batten and the top telltale (height fraction where its centre line meets the leech). */
const INSIGNIA_V = 0.86

const toPx = (x: number, y: number): [number, number] => [x * PX, H - y * PX]
const leechX = (y: number) => chordAt(y / LUFF)
/** Unit vector along the battens pointing in toward the luff, and its perpendicular pointing up toward the head. */
const INWARD = new THREE.Vector2(-Math.cos(BATTEN_TILT), -Math.sin(BATTEN_TILT))
const NORMAL = new THREE.Vector2(INWARD.y, -INWARD.x)
/** Canvas rotation (radians) that lines text up with the battens, reading luff → leech. */
const BATTEN_ROTATION = Math.atan2(INWARD.y, -INWARD.x)

const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
/** `t` metres from `p` along the batten direction (+ve toward the luff). */
const alongBatten = (p: Pt, t: number): Pt => [p[0] + INWARD.x * t, p[1] + INWARD.y * t]
/** `t` metres from `p` square to the battens (+ve toward the head). */
const alongNormal = (p: Pt, t: number): Pt => [p[0] + NORMAL.x * t, p[1] + NORMAL.y * t]
/** Distance from `p` along the batten direction to the luff. */
const inwardToLuff = (p: Pt) => p[0] / -INWARD.x

/** Double-stitched seam between two points in metres. */
function seam(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const nx = (-(b[1] - a[1]) / len) * 0.012
  const ny = ((b[0] - a[0]) / len) * 0.012
  for (const k of [0, 1]) {
    ctx.beginPath()
    ctx.moveTo(...toPx(a[0] + nx * k, a[1] + ny * k))
    ctx.lineTo(...toPx(b[0] + nx * k, b[1] + ny * k))
    ctx.stroke()
  }
}

function outline(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(...toPx(0, 0))
  ctx.lineTo(...toPx(0, LUFF))
  for (let i = 40; i >= 0; i--) ctx.lineTo(...toPx(leechX((i / 40) * LUFF), (i / 40) * LUFF))
  ctx.closePath()
}

/** Straight line in metres, from a leech point running inward (toward the luff) for `len` metres. */
function fromLeech(ctx: CanvasRenderingContext2D, y: number, len: number) {
  const x = leechX(y)
  ctx.beginPath()
  ctx.moveTo(...toPx(x, y))
  ctx.lineTo(...toPx(x + INWARD.x * len, y + INWARD.y * len))
}

/**
 * Text centred at (x, y) metres, `size` m tall, rotated by `angle` on the canvas; mirrored for the face whose UVs
 * run right-to-left (mirroring after the rotation keeps it on the same line as seen from that side).
 * `colors` is one fill, or [top, bottom] for letters split across the middle.
 */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, maxWidth: number, mirror: boolean, font: string, colors: string | [string, string], angle = 0) {
  const [px, py] = toPx(x, y)
  const sizePx = Math.round(size * PX)
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(angle)
  if (mirror) ctx.scale(-1, 1)
  ctx.font = `${font} ${sizePx}px Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(s).width
  if (w > maxWidth * PX) ctx.scale((maxWidth * PX) / w, 1)
  const fills = typeof colors === 'string' ? [colors] : colors
  fills.forEach((color, i) => {
    ctx.save()
    if (fills.length > 1) {
      ctx.beginPath()
      ctx.rect(-w, i === 0 ? -sizePx : 0, 2 * w, sizePx)
      ctx.clip()
    }
    ctx.fillStyle = color
    ctx.fillText(s, 0, 0)
    ctx.restore()
  })
  ctx.restore()
}

/**
 * Artwork for one face of the sail. The starboard face is the mesh's front face; seen from starboard the luff
 * is on the viewer's right, so its lettering is drawn mirrored to read correctly.
 */
export function makeSailTexture(side: 'port' | 'starboard'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const mirror = side === 'starboard'

  ctx.fillStyle = CLOTH
  ctx.fillRect(0, 0, W, H)
  outline(ctx)
  ctx.save()
  ctx.clip()

  // Radial panel seams: a cross seam along the middle batten, panels fanning from the clew below it and from the head above.
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 2
  const clew: Pt = [FOOT, 0]
  const head: Pt = [HEAD_WIDTH / 2, LUFF]
  const joinLeech: Pt = [leechX(JOIN_V * LUFF), JOIN_V * LUFF]
  const joinLuff = alongBatten(joinLeech, inwardToLuff(joinLeech))
  seam(ctx, joinLuff, joinLeech)
  // Clew radials end evenly along the luff (above the tack) and on along the cross seam.
  const tackRun = joinLuff[1] - 0.4
  const joinRun = Math.hypot(joinLeech[0] - joinLuff[0], joinLeech[1] - joinLuff[1])
  for (let i = 1; i < CLEW_RADIALS; i++) {
    const s = (i / CLEW_RADIALS) * (tackRun + joinRun)
    seam(ctx, clew, s < tackRun ? [0, 0.4 + s] : lerpPt(joinLuff, joinLeech, (s - tackRun) / joinRun))
  }
  for (let i = 1; i < HEAD_RADIALS; i++) seam(ctx, head, lerpPt(joinLuff, joinLeech, i / HEAD_RADIALS))

  // Clear window low in the luff panel.
  const [ww, wh] = WINDOW_SIZE
  const windowAft = alongBatten(WINDOW_AT, -ww)
  const windowCorners: Pt[] = [WINDOW_AT, windowAft, alongNormal(windowAft, wh), alongNormal(WINDOW_AT, wh)]
  ctx.beginPath()
  windowCorners.forEach((p, i) => (i ? ctx.lineTo(...toPx(...p)) : ctx.moveTo(...toPx(...p))))
  ctx.closePath()
  ctx.fillStyle = WINDOW
  ctx.fill()
  ctx.strokeStyle = 'rgba(150, 140, 115, 0.6)'
  ctx.lineWidth = 0.025 * PX
  ctx.stroke()

  // Luff sleeve (slides over the mast) and foot tabling.
  ctx.fillStyle = PATCH
  ctx.fillRect(...toPx(0, LUFF), 0.08 * PX, LUFF * PX)
  ctx.fillRect(...toPx(0, 0.04), FOOT * PX, 0.04 * PX)

  // Reinforcement patches at head, tack and clew: layered fans, darker where they overlap, stitched radially out to the rim.
  ctx.fillStyle = 'rgba(150, 140, 115, 0.06)'
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 1.5
  for (const [cx, cy, r] of CORNERS) {
    for (const k of CORNER_RINGS) {
      ctx.beginPath()
      ctx.arc(...toPx(cx, cy), r * k * PX, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath()
    for (let i = 0; i < CORNER_RADIALS; i++) {
      const a = (i / CORNER_RADIALS) * Math.PI * 2
      ctx.moveTo(...toPx(cx, cy))
      ctx.lineTo(...toPx(cx + r * Math.cos(a), cy + r * Math.sin(a)))
    }
    ctx.stroke()
  }

  // Batten pockets: a stitched cloth strip with the batten showing through.
  ctx.lineCap = 'butt'
  for (const [v, len] of BATTENS) {
    const y = v * LUFF
    ctx.strokeStyle = 'rgba(150, 140, 115, 0.45)'
    ctx.lineWidth = 0.08 * PX
    fromLeech(ctx, y, len)
    ctx.stroke()
    ctx.strokeStyle = SEAM
    ctx.lineWidth = 2
    const leech: Pt = [leechX(y), y]
    for (const off of [-0.04, 0.04]) seam(ctx, alongNormal(leech, off), alongNormal(alongBatten(leech, len), off))
    ctx.strokeStyle = BATTEN
    ctx.lineWidth = 0.03 * PX
    fromLeech(ctx, y, len - 0.05)
    ctx.stroke()
  }
  ctx.restore()

  // Class insignia between the top batten and the head, lined up with the battens.
  const insigniaLeech: Pt = [leechX(INSIGNIA_V * LUFF), INSIGNIA_V * LUFF]
  const insigniaRun = inwardToLuff(insigniaLeech) - 0.1 // clear of the luff sleeve
  const [ix, iy] = alongBatten(insigniaLeech, insigniaRun / 2)
  text(ctx, 'ILCA', ix, iy, 0.22, insigniaRun - 0.12, mirror, 'italic 900', [INSIGNIA_TOP, INSIGNIA_BOTTOM], BATTEN_ROTATION)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
