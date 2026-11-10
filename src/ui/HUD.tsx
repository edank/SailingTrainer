import { useSim, toDeg, nextCamera, CAMERA_LABEL } from '../store'
import { MS_TO_KNOTS } from '../sim/math'
import { POINTS_OF_SAIL } from '../lessons/pointsOfSail'
import { Compass } from './Compass'

export function HUD() {
  const boat = useSim((s) => s.boat)
  const d = useSim((s) => s.derived)
  const wind = useSim((s) => s.wind)
  const camera = useSim((s) => s.camera)
  const setCamera = useSim((s) => s.setCamera)
  const setWind = useSim((s) => s.setWind)
  const reset = useSim((s) => s.reset)

  const twaAbs = Math.abs(toDeg(d.twa))
  const pos = POINTS_OF_SAIL.find((p) => twaAbs >= p.twaRange[0] && twaAbs < p.twaRange[1]) ?? POINTS_OF_SAIL[5]
  const kn = (v: number) => (v * MS_TO_KNOTS).toFixed(1)

  return (
    <>
      <div className="hud hud-left">
        <div className="hud-title">ILCA Trainer <span className="muted">POC</span></div>
        <div className="stat big">
          <span className="val">{kn(boat.speed)}</span>
          <span className="unit">kn</span>
          <span className="muted small">/ {kn(d.polarSpeed)} max</span>
        </div>
        <div className="stat-row">
          <Stat label="TWA" value={`${twaAbs}°`} />
          <Stat label="AWA" value={`${Math.abs(toDeg(d.awa))}°`} />
          <Stat label="Tack" value={d.tack} />
          <Stat label="Heel" value={`${Math.abs(toDeg(boat.heel))}°`} />
        </div>
        <div className="pos-badge">{pos.name}</div>
        <div className={`trim-badge ${d.luffing ? 'bad' : d.trimEfficiency > 0.85 ? 'good' : 'ok'}`}>
          {d.luffing ? 'Luffing — sheet in or bear away' : d.telltales.leeward === 'stalled' ? 'Stalled — ease the sheet' : d.telltales.windward === 'lifting' ? 'Pinching — bear away or sheet in' : 'Trim OK'}
        </div>
      </div>

      <div className="hud hud-right">
        <Compass />
        <div className="wind-ctl">
          <label>
            Wind {kn(wind.speed)} kn
            <input type="range" min={1.5} max={12} step={0.25} value={wind.speed} onChange={(e) => setWind({ speed: +e.target.value })} />
          </label>
          <label>
            From {toDeg(wind.fromDir)}°
            <input type="range" min={0} max={359} step={1} value={toDeg(wind.fromDir)} onChange={(e) => setWind({ fromDir: (+e.target.value * Math.PI) / 180 })} />
          </label>
        </div>
        <div className="btn-row">
          <button onClick={() => setCamera(nextCamera(camera))}>{CAMERA_LABEL[nextCamera(camera)]} <kbd>C</kbd></button>
          <button onClick={reset}>Reset <kbd>R</kbd></button>
        </div>
      </div>
    </>
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
