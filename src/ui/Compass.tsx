import { useSim } from '../store'
import { POINTS_OF_SAIL } from '../lessons/pointsOfSail'

const R = 64
const C = 80

/**
 * Wind-relative rose: wind always blows from the top, the boat rotates to show its TWA.
 * Sectors are the points of sail, so the learner sees where they are on the diagram at a glance.
 */
export function Compass() {
  const twa = useSim((s) => s.derived.twa)
  const heading = useSim((s) => s.boat.heading)
  const twaDeg = (twa * 180) / Math.PI
  // Boat drawn pointing up, rotated so the wind (top) sits at the correct relative angle.
  const boatRot = -twaDeg

  return (
    <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} className="compass">
      {POINTS_OF_SAIL.map((p) => {
        const [a0, a1] = p.twaRange
        const current = Math.abs(twaDeg) >= a0 && Math.abs(twaDeg) < a1
        return (
          <g key={p.id}>
            <path d={sector(a0, a1)} className={current ? 'sector current' : 'sector'} />
            <path d={sector(-a1, -a0)} className={current ? 'sector current' : 'sector'} />
          </g>
        )
      })}
      <circle cx={C} cy={C} r={R} className="rose-ring" />
      {/* Wind arrow from the top */}
      <g className="wind-arrow">
        <line x1={C} y1={4} x2={C} y2={30} />
        <polygon points={`${C - 6},24 ${C + 6},24 ${C},34`} />
      </g>
      {/* Boat */}
      <g transform={`rotate(${boatRot} ${C} ${C})`} className="rose-boat">
        <path d={`M ${C} ${C - 22} C ${C + 10} ${C - 12}, ${C + 9} ${C + 10}, ${C + 6} ${C + 18} L ${C - 6} ${C + 18} C ${C - 9} ${C + 10}, ${C - 10} ${C - 12}, ${C} ${C - 22} Z`} />
      </g>
      <text x={C} y={C * 2 - 4} textAnchor="middle" className="rose-label">
        HDG {Math.round(((heading * 180) / Math.PI + 360) % 360)
          .toString()
          .padStart(3, '0')}
        °
      </text>
    </svg>
  )

  function sector(a0: number, a1: number): string {
    const p0 = polar(a0)
    const p1 = polar(a1)
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0
    const sweep = a1 > a0 ? 1 : 0
    return `M ${C} ${C} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} ${sweep} ${p1.x} ${p1.y} Z`
  }
  function polar(deg: number) {
    const a = ((deg - 90) * Math.PI) / 180
    return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) }
  }
}
