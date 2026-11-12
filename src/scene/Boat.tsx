import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import {
  buildHull,
  COCKPIT_AFT_Z,
  COCKPIT_FLOOR_Y,
  COCKPIT_FWD_Z,
  deckHeightAtZ,
  HULL_GROUPS,
  HULL_HALF_BEAM,
  HULL_LENGTH,
  HULL_SHEER_AT_BEAM,
  sheerLine,
} from './hullGeometry'
import { Sail } from './Sail'
import { BOOM_LENGTH, GOOSENECK_Y, HEAD_Y, MAST_FOOT_Y, MAST_Z, mastBendAt, sailFrame } from './sailGeometry'
import { Telltales } from './Telltales'
import { DraftStripes } from './DraftStripes'
import { Mast } from './Mast'

const HULL_COLOR = '#f2f4f6'
/** Non-skid deck and footwell: a shade greyer than the glossy topsides. */
const DECK_COLOR = '#e1e5e8'
const COCKPIT_COLOR = '#cfd5d9'
const GUNWALE_COLOR = '#3a4048'
const FOIL_COLOR = '#eceeed'
const TRIM_COLOR = '#939a98'
const SPAR_COLOR = '#8a9099'
const MAINSHEET_COLOR = '#e3c04a'
const STRAP_COLOR = '#1f3a68'
const VANG_ALONG_BOOM = 0.7
/** Mainsheet blocks: boom end, and mid-boom where it turns down to the ratchet block on the cockpit floor. */
const SHEET_ALONG_BOOM = 1.2
/** Traveller: a rope across the aft deck between two fairleads; the mainsheet block slides along it. */
const TRAVELLER_Z = HULL_LENGTH / 2 - 0.12
const TRAVELLER_HALF = 0.42
const TRAVELLER_BLOCK_Y = 0.42
/** Daggerboard: 0.341 m chord, 0.68 m below the keel; trunk just forward of the cockpit. */
const DAGGER_Z = COCKPIT_FWD_Z - 0.2
const DAGGER_CHORD = 0.34
const DAGGER_TOP = deckHeightAtZ(DAGGER_Z) + 0.14
const DAGGER_TIP = -0.1 - 0.68
/** When heeled, the boat rises so the leeward deck edge stays at least this far above the water. */
const RAIL_CLEARANCE = 0.05
const UP = new THREE.Vector3(0, 1, 0)
const segStart = new THREE.Vector3()
const segEnd = new THREE.Vector3()
const segDir = new THREE.Vector3()

/** How high the boat sits for a given heel; heel pivots at this height on the centreline. */
function rideHeight(heel: number): number {
  const a = Math.abs(heel)
  const railDip = HULL_HALF_BEAM * Math.sin(a) - HULL_SHEER_AT_BEAM * Math.cos(a)
  return Math.max(0, railDip + RAIL_CLEARANCE)
}

/** Places a unit-length, Y-aligned mesh (e.g. a rope cylinder) so it spans from a to b. */
function stretch(mesh: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!mesh) return
  segDir.subVectors(b, a)
  const len = segDir.length()
  mesh.position.copy(a).addScaledVector(segDir, 0.5)
  mesh.scale.set(1, len, 1)
  mesh.quaternion.setFromUnitVectors(UP, segDir.normalize())
}

/** A point `along` metres aft of the gooseneck on the (yawed, lifted) boom. */
function onBoom(f: ReturnType<typeof sailFrame>, along: number, out: THREE.Vector3) {
  return out.set(f.lx + f.dx * along, f.ly + f.dy * along, f.lz + f.dz * along)
}

function Rope({ color = TRIM_COLOR, radius = 0.01, ref }: { color?: string; radius?: number; ref: Ref<THREE.Mesh> }) {
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[radius, radius, 1, 6]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  )
}

export function Boat() {
  const group = useRef<THREE.Group>(null)
  const boom = useRef<THREE.Group>(null)
  const rudder = useRef<THREE.Group>(null)
  const fly = useRef<THREE.Group>(null)
  const vang = useRef<THREE.Mesh>(null)
  const sheetToTraveller = useRef<THREE.Mesh>(null)
  const sheetToRatchet = useRef<THREE.Mesh>(null)
  const travellerPort = useRef<THREE.Mesh>(null)
  const travellerStbd = useRef<THREE.Mesh>(null)
  const travellerBlock = useRef<THREE.Mesh>(null)
  const hull = useMemo(() => buildHull(), [])
  const gunwales = useMemo(() => [-1, 1].map((side) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sheerLine(side)), 60, 0.018, 6)), [])
  const fittings = useMemo(() => {
    const fairlead = (side: number) => new THREE.Vector3(side * TRAVELLER_HALF, deckHeightAtZ(TRAVELLER_Z) - 0.02, TRAVELLER_Z)
    const ratchet = new THREE.Vector3(0, COCKPIT_FLOOR_Y + 0.1, COCKPIT_FWD_Z + 0.12)
    // Hiking strap: from the trunk at the front of the footwell to the aft wall, held just off the floor.
    const strapFrom = new THREE.Vector3(0, COCKPIT_FLOOR_Y + 0.05, COCKPIT_FWD_Z + 0.02)
    const strapTo = new THREE.Vector3(0, COCKPIT_FLOOR_Y + 0.12, COCKPIT_AFT_Z - 0.02)
    const strap = new THREE.Object3D()
    stretch(strap, strapFrom, strapTo)
    return { portFairlead: fairlead(-1), stbdFairlead: fairlead(1), ratchet, strap }
  }, [])

  useFrame(() => {
    const { boat, derived } = useSim.getState()
    if (group.current) {
      group.current.position.set(boat.x, rideHeight(boat.heel), boat.z)
      group.current.rotation.set(0, -boat.heading, -boat.heel)
    }
    if (boom.current) {
      // Yaw with the sheet, then pitch up when nothing holds it down; follow the bent mast.
      boom.current.rotation.set(-derived.boomLift, derived.boomAngle, 0, 'YXZ')
      boom.current.position.z = MAST_Z + mastBendAt(GOOSENECK_Y, derived.mastBend)
    }
    // Tiller swings opposite to the turn: steering to starboard pushes it to port.
    if (rudder.current) rudder.current.rotation.y = boat.tiller * 0.6
    if (fly.current) {
      fly.current.rotation.y = -derived.awa
      fly.current.position.z = MAST_Z + mastBendAt(HEAD_Y, derived.mastBend)
    }
    const f = sailFrame(0, derived)
    // Vang: from the mast foot up to the boom, following the boom as it swings and lifts.
    stretch(vang.current, segStart.set(0, MAST_FOOT_Y + 0.08, MAST_Z), onBoom(f, VANG_ALONG_BOOM, segEnd))
    // Mainsheet: boom end down to the traveller block, which slides toward the boom's side.
    onBoom(f, BOOM_LENGTH - 0.05, segStart)
    const block = travellerBlock.current
    if (block) {
      block.position.set(THREE.MathUtils.clamp(segStart.x, -TRAVELLER_HALF + 0.08, TRAVELLER_HALF - 0.08), TRAVELLER_BLOCK_Y, TRAVELLER_Z)
      stretch(sheetToTraveller.current, segStart, block.position)
      stretch(travellerPort.current, fittings.portFairlead, block.position)
      stretch(travellerStbd.current, fittings.stbdFairlead, block.position)
    }
    stretch(sheetToRatchet.current, onBoom(f, SHEET_ALONG_BOOM, segStart), fittings.ratchet)
  })

  return (
    <group ref={group}>
      {/* Hull, crowned non-skid deck, and the recessed footwell */}
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial attach={`material-${HULL_GROUPS.hull}`} color={HULL_COLOR} roughness={0.35} />
        <meshStandardMaterial attach={`material-${HULL_GROUPS.deck}`} color={DECK_COLOR} roughness={0.85} />
        <meshStandardMaterial attach={`material-${HULL_GROUPS.cockpit}`} color={COCKPIT_COLOR} roughness={0.9} />
      </mesh>
      {/* Gunwale rubbing strip along each sheer */}
      {gunwales.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.6} />
        </mesh>
      ))}

      {/* Daggerboard trunk slot and board; the head with its handle stands proud of the deck */}
      <mesh position={[0, deckHeightAtZ(DAGGER_Z) + 0.003, DAGGER_Z]}>
        <boxGeometry args={[0.06, 0.012, DAGGER_CHORD + 0.05]} />
        <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, (DAGGER_TOP + DAGGER_TIP) / 2, DAGGER_Z]} castShadow>
        <boxGeometry args={[0.03, DAGGER_TOP - DAGGER_TIP, DAGGER_CHORD]} />
        <meshStandardMaterial color={FOIL_COLOR} roughness={0.5} />
      </mesh>
      <mesh position={[0, DAGGER_TOP + 0.02, DAGGER_Z + 0.04]}>
        <boxGeometry args={[0.036, 0.04, 0.16]} />
        <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.7} />
      </mesh>

      {/* Hiking strap */}
      <mesh position={fittings.strap.position} quaternion={fittings.strap.quaternion} scale={fittings.strap.scale}>
        <boxGeometry args={[0.08, 1, 0.01]} />
        <meshStandardMaterial color={STRAP_COLOR} roughness={0.9} />
      </mesh>

      {/* Mainsheet ratchet block on the cockpit floor */}
      <mesh position={fittings.ratchet}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.6} />
      </mesh>

      {/* Traveller rope, its block, and the mainsheet (positioned per frame) */}
      <Rope ref={travellerPort} color={TRIM_COLOR} radius={0.007} />
      <Rope ref={travellerStbd} color={TRIM_COLOR} radius={0.007} />
      <mesh ref={travellerBlock}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.6} />
      </mesh>
      <Rope ref={sheetToTraveller} color={MAINSHEET_COLOR} />
      <Rope ref={sheetToRatchet} color={MAINSHEET_COLOR} />

      {/* Rudder + tiller, pivot at the transom */}
      <group ref={rudder} position={[0, 0.25, HULL_LENGTH / 2 + 0.04]}>
        {/* Blade: ILCA max 635 mm long, 203 mm chord; top stays where the rudder head meets it */}
        <mesh position={[0, -0.375, 0.04]}>
          <boxGeometry args={[0.02, 0.6, 0.2]} />
          <meshStandardMaterial color={FOIL_COLOR} roughness={0.5} />
        </mesh>
        {/* Rudder head: spans from the blade top up to where the tiller's aft end enters it */}
        <mesh position={[0, 0.06, 0.04]}>
          <boxGeometry args={[0.06, 0.3, 0.14]} />
          <meshStandardMaterial color={SPAR_COLOR} roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.12, -0.75]} rotation-x={Math.PI / 2 - 0.08}>
          <cylinderGeometry args={[0.018, 0.022, 1.5, 6]} />
          <meshStandardMaterial color={SPAR_COLOR} roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Tiller extension (hiking stick), from a joint at the tiller's forward end */}
        <mesh position={[0, 0.06 + 0.15, -1.5 - 0.42]} rotation-x={0.34 - Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.9, 6]} />
          <meshStandardMaterial color={GUNWALE_COLOR} roughness={0.6} />
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

      <Rope ref={vang} radius={0.013} />

      {/* Sail deforms itself from the sim; it already includes boom angle, lift and mast bend */}
      <Sail />
      <DraftStripes />
      <Telltales side={1} />
      <Telltales side={-1} />
    </group>
  )
}
