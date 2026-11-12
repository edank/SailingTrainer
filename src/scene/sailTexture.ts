import * as THREE from 'three'
import { chordAt, FOOT, GOOSENECK_Y, HEAD_WIDTH, HEAD_Y } from './sailGeometry'

/**
 * Sail cloth artwork, drawn once on a canvas in metres: x = distance aft of the luff (0 … FOOT),
 * y = height above the foot (0 … LUFF). The sail mesh's UVs use the same metric mapping.
 */
export const LUFF = HEAD_Y - GOOSENECK_Y
const PX = 200 // canvas pixels per metre
const W = Math.round(FOOT * PX)
const H = Math.round(LUFF * PX)

const CLOTH = '#f4f1e8'
const SEAM = 'rgba(120, 110, 90, 0.35)'
const PATCH = 'rgba(150, 140, 115, 0.12)'
const INSIGNIA = '#d2232a'
const NUMBER_COLOR = '#1b2330'
const SAIL_NUMBER = '212345'
/** Cross-cut panels: seams run square to the leech at this spacing along it. */
const PANEL = 0.78
/** Batten pockets: [height fraction on the leech, length m]; ILCA has three, the top one shorter. */
const BATTENS: [number, number][] = [
  [0.28, 0.72],
  [0.52, 0.72],
  [0.76, 0.48],
]
/** Sail numbers sit higher on the starboard side so the two sides don't overlap (RRS Appendix G). */
const NUMBER_HEIGHT = { starboard: 0.6, port: 0.5 }

const toPx = (x: number, y: number): [number, number] => [x * PX, H - y * PX]
const leechX = (y: number) => chordAt(y / LUFF)
/** Unit vector up the leech, and its perpendicular pointing in toward the luff. */
const LEECH = new THREE.Vector2(HEAD_WIDTH - FOOT, LUFF).normalize()
const INWARD = new THREE.Vector2(-LEECH.y, LEECH.x)

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

/** Text centred at (x, y) metres, `size` m tall; mirrored for the face whose UVs run right-to-left. */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, maxWidth: number, mirror: boolean, font: string) {
  const [px, py] = toPx(x, y)
  ctx.save()
  ctx.translate(px, py)
  if (mirror) ctx.scale(-1, 1)
  ctx.font = `${font} ${Math.round(size * PX)}px Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(s).width
  if (w > maxWidth * PX) ctx.scale((maxWidth * PX) / w, 1)
  ctx.fillText(s, 0, 0)
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

  // Cross-cut panel seams (double stitched).
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 2
  const leechLen = Math.hypot(FOOT - HEAD_WIDTH, LUFF)
  for (let d = PANEL; d < leechLen - 0.2; d += PANEL) {
    for (const off of [0, 0.012]) {
      fromLeech(ctx, d * LEECH.y + off, 4)
      ctx.stroke()
    }
  }

  // Luff sleeve (slides over the mast) and foot tabling.
  ctx.fillStyle = PATCH
  ctx.fillRect(...toPx(0, LUFF), 0.08 * PX, LUFF * PX)
  ctx.fillRect(...toPx(0, 0.04), FOOT * PX, 0.04 * PX)

  // Reinforcement patches at head, tack and clew: layered fans, darker where they overlap.
  const corners: [number, number, number][] = [
    [HEAD_WIDTH / 2, LUFF, 0.9],
    [0, 0, 0.75],
    [FOOT, 0, 0.75],
  ]
  ctx.fillStyle = 'rgba(150, 140, 115, 0.06)'
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 1.5
  for (const [cx, cy, r] of corners) {
    for (const k of [1, 0.7, 0.45]) {
      ctx.beginPath()
      ctx.arc(...toPx(cx, cy), r * k * PX, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  // Batten pockets square to the leech.
  for (const [v, len] of BATTENS) {
    const y = v * LUFF
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(150, 140, 115, 0.35)'
    ctx.lineWidth = 0.06 * PX
    fromLeech(ctx, y, len)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(80, 75, 60, 0.45)'
    ctx.lineWidth = 0.018 * PX
    fromLeech(ctx, y, len - 0.04)
    ctx.stroke()
  }
  ctx.restore()

  // Class insignia near the head, and the sail number below it.
  const insigniaY = 0.84 * LUFF
  const insigniaX = leechX(insigniaY) / 2 + 0.02
  ctx.fillStyle = INSIGNIA
  text(ctx, 'ILCA', insigniaX, insigniaY, 0.2, leechX(insigniaY) - 0.16, mirror, 'italic 900')
  ctx.fillRect(...toPx(insigniaX - 0.22, insigniaY - 0.13), 0.44 * PX, 0.025 * PX)

  const numberY = NUMBER_HEIGHT[side] * LUFF
  ctx.fillStyle = NUMBER_COLOR
  text(ctx, SAIL_NUMBER, leechX(numberY) / 2 + 0.02, numberY, 0.3, leechX(numberY) - 0.2, mirror, 'bold')

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
