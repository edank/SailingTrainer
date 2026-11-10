import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ComponentRef } from 'react'
import { useSim } from '../store'
import type { TelltaleState } from '../sim/types'
import { bulgeAt, sailFrame, sailPoint } from './sailGeometry'

const HEIGHTS = [0.3, 0.55, 0.8]
const CHORD_FRAC = 0.22
const LEN = 0.45
const SEGS = 6

interface Props {
  /** +1 = starboard side of the sail, -1 = port. */
  side: 1 | -1
}

/**
 * Three ribbons per side at ~22% chord. Colour follows the sailing convention
 * (red = port, green = starboard). Motion encodes state: streaming aft when flowing,
 * fluttering up when lifting (windward, too little angle), hanging/swirling when stalled (leeward, too much).
 */
export function Telltales({ side }: Props) {
  const refs = useRef<(ComponentRef<typeof Line> | null)[]>([])
  const time = useRef(0)
  const color = side === 1 ? '#39d353' : '#ff5a5f'

  useFrame((_, dt) => {
    time.current += dt
    const d = useSim.getState().derived
    const t = time.current
    const anchor = [0, 0, 0]

    HEIGHTS.forEach((v, n) => {
      const line = refs.current[n]
      if (!line) return
      const f = sailFrame(v, d)
      const state: TelltaleState = side === f.side ? d.telltales.leeward : d.telltales.windward
      // Anchor just off the cloth on this side; sail normal points to leeward so flip for windward.
      const off = 0.05 * (side === f.side ? 1 : -1)
      sailPoint(CHORD_FRAC, f, bulgeAt(CHORD_FRAC, f, d, t) + off, anchor)
      const [ax, ay, az] = anchor
      const pts: number[] = []
      for (let s = 0; s <= SEGS; s++) {
        const k = s / SEGS
        let x = ax, y = ay, z = az
        if (state === 'flowing') {
          x += f.dx * LEN * k + f.nx * Math.sin(10 * k - 12 * t) * 0.015
          z += f.dz * LEN * k + f.nz * Math.sin(10 * k - 12 * t) * 0.015
          y += Math.sin(8 * k - 10 * t) * 0.02
        } else if (state === 'lifting') {
          // Streams upward and flutters — classic "windward telltale lifting".
          x += f.dx * LEN * 0.4 * k
          z += f.dz * LEN * 0.4 * k
          y += LEN * 0.8 * k + Math.sin(14 * k - 18 * t + n) * 0.06 * k
        } else {
          // Stalled: droops and circles lazily.
          const swirl = Math.sin(5 * k - 4 * t) * 0.12 * k
          x += f.dx * LEN * 0.3 * k + f.nx * swirl
          z += f.dz * LEN * 0.3 * k + f.nz * swirl
          y -= LEN * 0.7 * k
        }
        pts.push(x, y, z)
      }
      line.geometry.setPositions(pts)
    })
  })

  return (
    <>
      {HEIGHTS.map((_, n) => (
        <Line
          key={n}
          ref={(el) => {
            refs.current[n] = el
          }}
          points={Array.from({ length: SEGS + 1 }, () => [0, 0, 0] as [number, number, number])}
          color={color}
          lineWidth={2.5}
        />
      ))}
    </>
  )
}
