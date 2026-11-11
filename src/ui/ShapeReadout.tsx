import { useSim } from '../store'
import { RAD } from '../sim/math'

/**
 * Sail-shape numbers read off the draft stripes. Hidden (CSS) until it returns in an advanced view;
 * its own component so the per-frame updates don't re-render the trim sliders.
 */
export function ShapeReadout() {
  const camber = useSim((s) => s.derived.camber)
  const draftPos = useSim((s) => s.derived.draftPos)
  const twist = useSim((s) => s.derived.twist)
  const mastBend = useSim((s) => s.derived.mastBend)
  return (
    <div className="shape-readout" title="Read these off the draft stripes on the sail">
      <span>Depth <b>{Math.round(camber * 100)}%</b></span>
      <span>Draft <b>{Math.round(draftPos * 100)}%</b></span>
      <span>Twist <b>{Math.round(twist * RAD)}°</b></span>
      <span>Bend <b>{Math.round(mastBend * 100)}%</b></span>
    </div>
  )
}
