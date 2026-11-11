import { useSim, toDeg, nextCamera, CAMERA_LABEL } from '../store'
import { MS_TO_KNOTS } from '../sim/math'
import type { Derived } from '../sim/types'
import { POINTS_OF_SAIL } from '../lessons/pointsOfSail'
import { useRef } from 'react'
import { useIsPhone } from '../hooks/useIsPhone'
import { useReportInset } from '../hooks/useViewInsets'
import { Compass } from './Compass'

const kn = (v: number) => (v * MS_TO_KNOTS).toFixed(1)

export function HUD() {
  const boat = useSim((s) => s.boat)
  const d = useSim((s) => s.derived)
  const isPhone = useIsPhone()
  const top = useRef<HTMLDivElement>(null)
  useReportInset(top, 'top', isPhone)
  const twaAbs = Math.abs(toDeg(d.twa))

  if (isPhone) {
    return (
      <div className="hud-top" ref={top}>
        <div className="hud hud-bar">
          <div className="bar-stats">
            <SpeedStat />
            <div className="bar-row">
              <Stat label="TWA" value={`${twaAbs}°`} />
              <PointOfSail />
            </div>
          </div>
          <Compass />
          <div className="bar-wind">
            <WindSlider />
            <ViewButtons />
          </div>
        </div>
        <TrimAdvice />
      </div>
    )
  }

  return (
    <>
      <div className="hud hud-left">
        <div className="hud-title">ILCA Trainer <span className="muted">POC</span></div>
        <SpeedStat />
        <div className="stat-row">
          <Stat label="TWA" value={`${twaAbs}°`} />
          <Stat label="AWA" value={`${Math.abs(toDeg(d.awa))}°`} />
          <Stat label="Tack" value={d.tack} />
          <Stat label="Heel" value={`${Math.abs(toDeg(boat.heel))}°`} />
        </div>
        <PointOfSail />
        <TrimAdvice />
      </div>

      <div className="hud hud-right">
        <Compass />
        <div className="wind-ctl">
          <WindSlider />
        </div>
        <ViewButtons />
      </div>
    </>
  )
}

function SpeedStat() {
  const speed = useSim((s) => s.boat.speed)
  const polarSpeed = useSim((s) => s.derived.polarSpeed)
  return (
    <div className="stat big">
      <span className="val">{kn(speed)}</span>
      <span className="unit">kn</span>
      <span className="muted small">/ {kn(polarSpeed)} max</span>
    </div>
  )
}

function PointOfSail() {
  const twaAbs = Math.abs(useSim((s) => toDeg(s.derived.twa)))
  const pos = POINTS_OF_SAIL.find((p) => twaAbs >= p.twaRange[0] && twaAbs < p.twaRange[1]) ?? POINTS_OF_SAIL[5]
  return <div className="pos-badge">{pos.name}</div>
}

function TrimAdvice() {
  const d = useSim((s) => s.derived)
  const { tone, text } = trimAdvice(d)
  return <div className={`trim-badge ${tone}`}>{text}</div>
}

/**
 * What to do next. The telltales say what's wrong; the mainsheet hint says whether the sheet can fix it.
 * Downwind with the sheet fully out the sail is stalled by design, so that alone is not a fault.
 */
function trimAdvice(d: Derived): { tone: 'good' | 'ok' | 'bad'; text: string } {
  if (d.inIrons) return { tone: 'bad', text: 'In irons — bear away' }
  // Outside the no-go zone a luffing sail always has room to sheet in.
  if (d.luffing) return { tone: 'bad', text: 'Luffing — sheet in' }
  const sheet = d.hints.mainsheet
  if (d.telltales.leeward === 'stalled' && sheet < 0) return { tone: 'ok', text: 'Stalled — ease the sheet' }
  if (d.telltales.windward === 'lifting' && sheet > 0) return { tone: 'ok', text: 'Sail too far out — sheet in' }
  const allGood = Object.values(d.hints).every((h) => h === 0)
  return { tone: allGood ? 'good' : 'ok', text: 'Trim OK' }
}

function WindSlider() {
  const speed = useSim((s) => s.wind.speed)
  const setWind = useSim((s) => s.setWind)
  return (
    <label>
      Wind {kn(speed)} kn
      <input type="range" min={1.5} max={12} step={0.25} value={speed} onChange={(e) => setWind({ speed: +e.target.value })} />
    </label>
  )
}

function ViewButtons() {
  const camera = useSim((s) => s.camera)
  const setCamera = useSim((s) => s.setCamera)
  return (
    <div className="btn-row">
      <button onClick={() => setCamera(nextCamera(camera))}>{CAMERA_LABEL[nextCamera(camera)]} <kbd>C</kbd></button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="val">{value}</span>
    </div>
  )
}
