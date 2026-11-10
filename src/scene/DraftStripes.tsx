import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ComponentRef } from 'react'
import { useSim } from '../store'
import { bulgeAt, sailFrame, sailPoint } from './sailGeometry'

/** Heights of the three stripes, as on a real racing sail. */
const HEIGHTS = [0.25, 0.5, 0.75]
const SEGS = 14
const OFFSET = 0.012 // sit just proud of the cloth on both sides

/**
 * Draft stripes: horizontal bands sailors use to read camber depth and draft position.
 * Drawn on both sides of the sail so the shape is readable from any camera angle.
 */
export function DraftStripes() {
  const refs = useRef<(ComponentRef<typeof Line> | null)[]>([])
  const time = useRef(0)

  useFrame((_, dt) => {
    time.current += dt
    const d = useSim.getState().derived
    HEIGHTS.forEach((v, n) => {
      const f = sailFrame(v, d)
      const pt = [0, 0, 0]
      for (const sideIdx of [0, 1]) {
        const line = refs.current[n * 2 + sideIdx]
        if (!line) continue
        const off = sideIdx === 0 ? OFFSET : -OFFSET
        const pts: number[] = []
        for (let s = 0; s <= SEGS; s++) {
          const u = s / SEGS
          sailPoint(u, f, bulgeAt(u, f, d, time.current) + off, pt)
          pts.push(pt[0], pt[1], pt[2])
        }
        line.geometry.setPositions(pts)
      }
    })
  })

  return (
    <>
      {HEIGHTS.flatMap((_, n) =>
        [0, 1].map((sideIdx) => (
          <Line
            key={`${n}-${sideIdx}`}
            ref={(el) => {
              refs.current[n * 2 + sideIdx] = el
            }}
            points={Array.from({ length: SEGS + 1 }, () => [0, 0, 0] as [number, number, number])}
            color="#2b3a4a"
            lineWidth={2}
            transparent
            opacity={0.75}
          />
        )),
      )}
    </>
  )
}
