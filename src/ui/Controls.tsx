import type { PointerEvent } from 'react'
import { virtualKeys } from '../hooks/useInput'
import { useSim } from '../store'
import type { Trim } from '../sim/types'
import { CONTROLS } from '../lessons/controls'
import { RAD } from '../sim/math'

const SLIDERS: { key: keyof Trim; keys?: string }[] = [
  { key: 'mainsheet', keys: '↑ / ↓' },
  { key: 'vang', keys: 'Q / E' },
  { key: 'cunningham' },
  { key: 'outhaul' },
]

export function Controls() {
  const trim = useSim((s) => s.boat.trim)
  const hints = useSim((s) => s.derived.hints)
  const camber = useSim((s) => s.derived.camber)
  const draftPos = useSim((s) => s.derived.draftPos)
  const twist = useSim((s) => s.derived.twist)
  const mastBend = useSim((s) => s.derived.mastBend)
  const setTrim = useSim((s) => s.setTrim)
  const setPanel = useSim((s) => s.setPanel)
  const panel = useSim((s) => s.panel)

  return (
    <>
      <div className="tiller">
        <HoldButton k="arrowleft" label="◀" title="Turn to port (← / A)" />
        <HoldButton k="arrowright" label="▶" title="Turn to starboard (→ / D)" />
      </div>

      <div className="trim-panel">
        <div className="shape-readout" title="Read these off the draft stripes on the sail">
          <span>Depth <b>{Math.round(camber * 100)}%</b></span>
          <span>Draft <b>{Math.round(draftPos * 100)}%</b></span>
          <span>Twist <b>{Math.round(twist * RAD)}°</b></span>
          <span>Bend <b>{Math.round(mastBend * 100)}%</b></span>
        </div>
        {SLIDERS.map(({ key, keys }) => {
          const info = CONTROLS.find((c) => c.id === key)
          const hint = hints[key]
          return (
            <label key={key} className="slider">
              <span className="slider-head">
                <span className="name" title={info?.whatItDoes}>
                  {info?.name ?? key}
                  {keys && <kbd>{keys}</kbd>}
                </span>
                <span className={`hint ${hint > 0 ? 'on' : hint < 0 ? 'ease' : 'ok'}`}>
                  {hint > 0 ? '▲ pull on' : hint < 0 ? '▼ ease' : '● good'}
                </span>
              </span>
              <input type="range" min={0} max={1} step={0.01} value={trim[key]} onChange={(e) => setTrim(key, +e.target.value)} />
            </label>
          )
        })}
        <button className="link" onClick={() => setPanel(panel === 'controls' ? null : 'controls')}>
          What do these ropes do?
        </button>
      </div>
    </>
  )
}

function HoldButton({ k, label, title }: { k: string; label: string; title: string }) {
  const start = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    virtualKeys.add(k)
  }
  const stop = () => virtualKeys.delete(k)
  return (
    <button
      className="hold"
      title={title}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}
