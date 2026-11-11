import { useSim, toDeg, nextCamera, CAMERA_LABEL } from '../store'
import { MS_TO_KNOTS } from '../sim/math'
import { POINTS_OF_SAIL } from '../lessons/pointsOfSail'
import { useIsPhone, useIsPhonePortrait } from '../hooks/useIsPhone'
import { Compass } from './Compass'
import { TrimAdvice } from './TrimAdvice'

const kn = (v: number) => (v * MS_TO_KNOTS).toFixed(1)

export function HUD() {
  const boat = useSim((s) => s.boat)
  const d = useSim((s) => s.derived)
  const isPhone = useIsPhone()
  const isPortrait = useIsPhonePortrait()
  const twaAbs = Math.abs(toDeg(d.twa))

  if (isPhone) {
    return (
      <>
        <div className="hud-top">
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
              {/* Portrait: in the top-right corner instead, keeping the card narrow. */}
              {!isPortrait && <CameraButton />}
            </div>
          </div>
        </div>
        {isPortrait && <CameraButton className="corner-camera" />}
      </>
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
        <div className="btn-row">
          <CameraButton />
        </div>
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

function CameraButton({ className }: { className?: string }) {
  const camera = useSim((s) => s.camera)
  const setCamera = useSim((s) => s.setCamera)
  return (
    <button className={className} onClick={() => setCamera(nextCamera(camera))}>
      {CAMERA_LABEL[nextCamera(camera)]} <kbd>C</kbd>
    </button>
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
