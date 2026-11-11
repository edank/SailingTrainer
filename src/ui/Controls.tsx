import type { PointerEvent } from 'react'
import { virtualKeys } from '../hooks/useInput'
import { useShallow } from 'zustand/react/shallow'
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
  // A fresh hints object comes out of every sim step; compare by value so the panel only re-renders on change.
  const hints = useSim(useShallow((s) => s.derived.hints))
  const inIrons = useSim((s) => s.derived.inIrons)
  const camber = useSim((s) => s.derived.camber)
  const draftPos = useSim((s) => s.derived.draftPos)
  const twist = useSim((s) => s.derived.twist)
  const mastBend = useSim((s) => s.derived.mastBend)
  const setTrim = useSim((s) => s.setTrim)
  const setPanel = useSim((s) => s.setPanel)
  const panel = useSim((s) => s.panel)
  const autoTrim = useSim((s) => s.autoTrim)
  const setAutoTrim = useSim((s) => s.setAutoTrim)
  const applyIdealTrim = useSim((s) => s.applyIdealTrim)

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
        <div className="trim-actions">
          <button onClick={applyIdealTrim} disabled={autoTrim}>Ideal trim</button>
          <label title="Keep every control at its ideal setting as you turn">
            <input type="checkbox" checked={autoTrim} onChange={(e) => setAutoTrim(e.target.checked)} />
            Keep ideal
          </label>
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
                <span className={`hint ${inIrons ? 'na' : hint > 0 ? 'on' : hint < 0 ? 'ease' : 'ok'}`}>
                  {inIrons ? '—' : hint > 0 ? '▲ pull on' : hint < 0 ? '▼ ease' : '● good'}
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
