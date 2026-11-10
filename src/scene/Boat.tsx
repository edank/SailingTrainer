import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { buildHull, deckHeightAt, HULL_LENGTH } from './hullGeometry'
import { Sail } from './Sail'
import { BOOM_LENGTH, GOOSENECK_Y, HEAD_Y, MAST_FOOT_Y, MAST_Z, mastBendAt, sailFrame } from './sailGeometry'
import { Telltales } from './Telltales'
import { DraftStripes } from './DraftStripes'
import { Mast } from './Mast'

const HULL_COLOR = '#f2f4f6'
const TRIM_COLOR = '#939a98'
// const TRIM_COLOR = '#2b3a4a'
const SPAR_COLOR = '#8a9099'
const VANG_ALONG_BOOM = 0.7
const UP = new THREE.Vector3(0, 1, 0)
const vangStart = new THREE.Vector3()
const vangEnd = new THREE.Vector3()
const vangDir = new THREE.Vector3()

export function Boat() {
  const group = useRef<THREE.Group>(null)
  const boom = useRef<THREE.Group>(null)
  const rudder = useRef<THREE.Group>(null)
  const fly = useRef<THREE.Group>(null)
  const vang = useRef<THREE.Mesh>(null)
  const hull = useMemo(() => buildHull(), [])
  const deckAtCockpit = deckHeightAt(0.6)

  useFrame(() => {
    const { boat, derived } = useSim.getState()
    if (group.current) {
      group.current.position.set(boat.x, 0, boat.z)
      group.current.rotation.set(0, -boat.heading, -boat.heel)
    }
    if (boom.current) {
      // Yaw with the sheet, then pitch up when nothing holds it down; follow the bent mast.
      boom.current.rotation.set(-derived.boomLift, derived.boomAngle, 0, 'YXZ')
      boom.current.position.z = MAST_Z + mastBendAt(GOOSENECK_Y, derived.mastBend)
    }
    if (rudder.current) rudder.current.rotation.y = -boat.tiller * 0.6
    if (fly.current) {
      fly.current.rotation.y = -derived.awa
      fly.current.position.z = MAST_Z + mastBendAt(HEAD_Y, derived.mastBend)
    }
    if (vang.current) {
      // Boom attachment: VANG_ALONG_BOOM metres aft of the gooseneck along the (yawed, lifted) boom.
      const f = sailFrame(0, derived)
      vangEnd.set(f.lx + f.dx * VANG_ALONG_BOOM, f.ly + f.dy * VANG_ALONG_BOOM, f.lz + f.dz * VANG_ALONG_BOOM)
      vangStart.set(0, MAST_FOOT_Y + 0.08, MAST_Z)
      vangDir.subVectors(vangEnd, vangStart)
      const len = vangDir.length()
      vang.current.position.copy(vangStart).addScaledVector(vangDir, 0.5)
      vang.current.scale.set(1, len, 1)
      vang.current.quaternion.setFromUnitVectors(UP, vangDir.normalize())
    }
  })

  return (
    <group ref={group}>
      {/* Hull + deck */}
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial color={HULL_COLOR} flatShading roughness={0.55} />
      </mesh>
      {/* Cockpit floor (sits just above the deck so it reads as a recess) */}
      <mesh position={[0, deckAtCockpit + 0.012, 0.55]}>
        <boxGeometry args={[0.75, 0.02, 1.7]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.9} />
      </mesh>

      {/* Daggerboard */}
      <mesh position={[0, -0.45, -0.15]}>
        <boxGeometry args={[0.03, 0.9, 0.35]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
      </mesh>

      {/* Rudder + tiller, pivot at the transom */}
      <group ref={rudder} position={[0, 0.25, HULL_LENGTH / 2 + 0.04]}>
        <mesh position={[0, -0.5, 0.04]}>
          <boxGeometry args={[0.03, 0.85, 0.3]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
        </mesh>
        {/* Rudder head: spans from the blade top up to where the tiller's aft end enters it */}
        <mesh position={[0, 0.06, 0.04]}>
          <boxGeometry args={[0.06, 0.3, 0.14]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.12, -0.75]} rotation-x={Math.PI / 2 - 0.08}>
          <cylinderGeometry args={[0.018, 0.022, 1.5, 6]} />
          <meshStandardMaterial color={SPAR_COLOR} roughness={0.5} metalness={0.3} />
        </mesh>
      </group>

      {/* Mast bends with vang/sheet tension */}
      <Mast />

      {/* Masthead fly (apparent-wind indicator) */}
      <group ref={fly} position={[0, HEAD_Y + 0.3, MAST_Z]}>
        <mesh position={[0, 0, -0.18]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.05, 0.16, 6]} />
          <meshStandardMaterial color="#ff7a00" />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.008, 0.008, 0.45, 4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>

      {/* Boom pivots around the mast at the gooseneck */}
      <group ref={boom} position={[0, GOOSENECK_Y, MAST_Z]}>
        <mesh position={[0, 0, BOOM_LENGTH / 2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.035, BOOM_LENGTH, 8]} />
          <meshStandardMaterial color={SPAR_COLOR} roughness={0.45} metalness={0.4} />
        </mesh>
        {/* Gooseneck fitting */}
        <mesh>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
        </mesh>
      </group>

      {/* Vang: from the mast foot up to the boom, following the boom as it swings and lifts */}
      <mesh ref={vang}>
        <cylinderGeometry args={[0.013, 0.013, 1, 6]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.7} />
      </mesh>

      {/* Sail deforms itself from the sim; it already includes boom angle, lift and mast bend */}
      <Sail />
      <DraftStripes />
      <Telltales side={1} />
      <Telltales side={-1} />
    </group>
  )
}
