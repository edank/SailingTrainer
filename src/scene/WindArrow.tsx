import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { HULL_HALF_BEAM, HULL_LENGTH } from './hullGeometry'

/** Full arrow length and its gap from the hull are both half a boat length; see fitScale for narrow screens. */
const ARROW_LENGTH = HULL_LENGTH / 2
const GAP = HULL_LENGTH / 2
const SHAFT_HALF_WIDTH = 0.12
const HEAD_HALF_WIDTH = 0.38
const HEAD_LENGTH = 0.7
/** Just above the wave crests (swell amplitude in Water.tsx peaks at ~0.14 m). */
const Y = 0.18
/** Fraction of the half-screen width the arrow may reach out to. */
const FIT_MARGIN = 0.85
/** Smallest reach (gap + length, as a fraction of full) on very narrow screens. */
const MIN_SCALE = 0.35
/** Shortest the shaft gets, so a shrunk arrow still reads as an arrow, not just a head. */
const MIN_SHAFT = 0.3

const toUpwind = new THREE.Vector3()
const camRight = new THREE.Vector3()
const camForward = new THREE.Vector3()
const toBoat = new THREE.Vector3()

/** Arrowhead in the XY plane, tip at the origin, pointing +Y. Fixed size. */
function buildHead(): THREE.ShapeGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(-HEAD_HALF_WIDTH, -HEAD_LENGTH)
  s.lineTo(HEAD_HALF_WIDTH, -HEAD_LENGTH)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

/** Unit-length shaft in the XY plane, from y = 0 down to y = -1; scaled in y to the wanted length. */
function buildShaft(): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(SHAFT_HALF_WIDTH * 2, 1).translate(0, -0.5, 0)
}

/** Distance from the boat's centre to the edge of its (elliptical) waterplane along a bearing relative to the bow. */
function hullRadius(relBearing: number): number {
  const c = Math.cos(relBearing) / (HULL_LENGTH / 2)
  const s = Math.sin(relBearing) / HULL_HALF_BEAM
  return 1 / Math.sqrt(c * c + s * s)
}

/**
 * Fraction of the full reach (gap + arrow length) that keeps the arrow's far end inside the visible
 * width at the boat's depth. 1 on wide screens; < 1 on narrow (phone portrait) ones with wind from the side.
 */
function fitScale(cam: THREE.PerspectiveCamera, upwind: THREE.Vector3, boatX: number, boatZ: number, hullR: number): number {
  const lateral = Math.abs(upwind.dot(camRight.setFromMatrixColumn(cam.matrixWorld, 0)))
  if (lateral < 1e-3) return 1
  cam.getWorldDirection(camForward)
  const depth = toBoat.set(boatX, Y, boatZ).sub(cam.position).dot(camForward)
  const halfWidth = depth * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * FIT_MARGIN
  return THREE.MathUtils.clamp((halfWidth / lateral - hullR) / (GAP + ARROW_LENGTH), MIN_SCALE, 1)
}

/**
 * True-wind indicator lying on the water on the upwind side of the boat, pointing downwind at it.
 * World-space (doesn't heel or yaw with the boat), so it always shows the true wind.
 */
export function WindArrow() {
  const group = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const head = useMemo(() => buildHead(), [])
  const shaftGeometry = useMemo(() => buildShaft(), [])

  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    const { boat, wind } = useSim.getState()
    // Bearing b → world direction (sin b, 0, -cos b); see sim/types.ts conventions.
    toUpwind.set(Math.sin(wind.fromDir), 0, -Math.cos(wind.fromDir))
    const hullR = hullRadius(wind.fromDir - boat.heading)
    const reach = fitScale(camera as THREE.PerspectiveCamera, toUpwind, boat.x, boat.z, hullR)
    // Only the gap and the shaft shrink; width and head stay full size.
    const tipDist = hullR + reach * GAP
    if (shaft.current) shaft.current.scale.y = Math.max(reach * ARROW_LENGTH - HEAD_LENGTH, MIN_SHAFT)
    g.position.set(boat.x + toUpwind.x * tipDist, Y, boat.z + toUpwind.z * tipDist)
    // Arrow points north (-Z) at rotation 0; turn it to point downwind (fromDir + π).
    g.rotation.y = -(wind.fromDir + Math.PI)
  })

  return (
    <group ref={group}>
      {/* Lay the XY-plane arrow flat on the water, pointing north (-Z) */}
      <group rotation-x={-Math.PI / 2}>
        <mesh geometry={head} renderOrder={1}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={shaft} geometry={shaftGeometry} position-y={-HEAD_LENGTH} renderOrder={1}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
