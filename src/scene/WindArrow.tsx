import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { HULL_HALF_BEAM, HULL_LENGTH } from './hullGeometry'

/** Arrow length and its gap from the hull are both half a boat length; size is fixed. */
const ARROW_LENGTH = HULL_LENGTH / 2
const GAP = HULL_LENGTH / 2
const SHAFT_HALF_WIDTH = 0.12
const HEAD_HALF_WIDTH = 0.38
const HEAD_LENGTH = 0.7
/** Just above the wave crests (swell amplitude in Water.tsx peaks at ~0.14 m). */
const Y = 0.18

/** Flat arrow in the XY plane, centred on the origin, pointing +Y. */
function buildArrow(): THREE.ShapeGeometry {
  const half = ARROW_LENGTH / 2
  const neck = half - HEAD_LENGTH
  const s = new THREE.Shape()
  s.moveTo(-SHAFT_HALF_WIDTH, -half)
  s.lineTo(SHAFT_HALF_WIDTH, -half)
  s.lineTo(SHAFT_HALF_WIDTH, neck)
  s.lineTo(HEAD_HALF_WIDTH, neck)
  s.lineTo(0, half)
  s.lineTo(-HEAD_HALF_WIDTH, neck)
  s.lineTo(-SHAFT_HALF_WIDTH, neck)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

/** Distance from the boat's centre to the edge of its (elliptical) waterplane along a bearing relative to the bow. */
function hullRadius(relBearing: number): number {
  const c = Math.cos(relBearing) / (HULL_LENGTH / 2)
  const s = Math.sin(relBearing) / HULL_HALF_BEAM
  return 1 / Math.sqrt(c * c + s * s)
}

/**
 * True-wind indicator lying on the water on the upwind side of the boat, pointing downwind at it.
 * World-space (doesn't heel or yaw with the boat), so it always shows the true wind.
 */
export function WindArrow() {
  const group = useRef<THREE.Group>(null)
  const geometry = useMemo(() => buildArrow(), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { boat, wind } = useSim.getState()
    const dist = hullRadius(wind.fromDir - boat.heading) + GAP + ARROW_LENGTH / 2
    // Bearing b → world direction (sin b, 0, -cos b); see sim/types.ts conventions.
    g.position.set(boat.x + Math.sin(wind.fromDir) * dist, Y, boat.z - Math.cos(wind.fromDir) * dist)
    // Arrow points north (-Z) at rotation 0; turn it to point downwind (fromDir + π).
    g.rotation.y = -(wind.fromDir + Math.PI)
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry} rotation-x={-Math.PI / 2} renderOrder={1}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
