import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSim, type CameraMode } from '../store'
import { viewInsets } from '../hooks/useViewInsets'
import type { BoatState } from '../sim/types'

const CHASE_OFFSET = new THREE.Vector3(0, 5.2, 12.5) // behind (+Z local) and above
// Leeward and a little forward of abeam, so the sheeted sail is seen broadside rather than edge-on.
const SAIL_OFFSET = new THREE.Vector3(9.0, 3.2, -4.5) // x is mirrored to the leeward side
const TOP_HEIGHT = 13
/**
 * What must stay on screen when UI covers part of it (phones): a centre in the boat's own (heeled)
 * frame, and half-extents (m) around it — rx across the screen, ry up/down. Sized to cover the
 * masthead fly, the boom swung out, bow and stern. Following the heel keeps the leaning rig in shot.
 */
const SUBJECT: Record<CameraMode, { center: THREE.Vector3; rx: number; ry: number }> = {
  chase: { center: new THREE.Vector3(0, 2.6, 0), rx: 3.2, ry: 4.2 },
  sail: { center: new THREE.Vector3(0, 3.2, -0.3), rx: 3.2, ry: 3.8 },
  top: { center: new THREE.Vector3(0, 2.6, 0), rx: 3.6, ry: 3.6 },
}
const HEEL_AXIS = new THREE.Vector3(0, 0, 1)

const tmpPos = new THREE.Vector3()
const tmpLook = new THREE.Vector3()
const tmpUp = new THREE.Vector3()
const tmpBoat = new THREE.Vector3()
const tmpOffset = new THREE.Vector3()

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const mode = useSim((s) => s.camera)
  const first = useRef(true)

  // Snap on mode change so the transition isn't a slow swoop through the water.
  useEffect(() => {
    first.current = true
  }, [mode])

  useFrame((_, dt) => {
    const { boat } = useSim.getState()
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3)
    first.current = false

    if (mode === 'chase') {
      tmpPos.copy(CHASE_OFFSET).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -boat.heading)
      tmpPos.add(tmpBoat.set(boat.x, 0, boat.z))
      tmpLook.set(boat.x, 2.2, boat.z)
      tmpUp.set(0, 1, 0)
    } else if (mode === 'sail') {
      // Abeam on the leeward side, slightly aft, looking at the middle of the sail —
      // the view a coach in a RIB has when talking about sail shape.
      const { twa } = useSim.getState().derived
      const leeward = twa >= 0 ? -1 : 1
      tmpPos.set(leeward * SAIL_OFFSET.x, SAIL_OFFSET.y, SAIL_OFFSET.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -boat.heading)
      tmpPos.add(tmpBoat.set(boat.x, 0, boat.z))
      tmpLook.set(0, 3.2, -0.3).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -boat.heading).add(tmpBoat)
      tmpUp.set(0, 1, 0)
    } else {
      tmpPos.set(boat.x, TOP_HEIGHT, boat.z + 0.01)
      tmpLook.set(boat.x, 0, boat.z)
      tmpUp.set(0, 0, -1) // north up
    }
    frameInStrip(camera, mode, boat, size.width, size.height)
    camera.position.lerp(tmpPos, k)
    camera.up.lerp(tmpUp, k).normalize()
    camera.lookAt(tmpLook)
  })

  return null
}

/**
 * With UI covering the top/bottom of the screen (phones), aim at the subject's centre, back the camera
 * off along its line until the subject fits the uncovered strip, and shift the projection to centre it there.
 */
function frameInStrip(camera: THREE.PerspectiveCamera, mode: CameraMode, boat: BoatState, width: number, height: number) {
  const { top, bottom } = viewInsets
  if (top === 0 && bottom === 0) {
    if (camera.view?.enabled) camera.clearViewOffset()
    return
  }
  const strip = height - top - bottom
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const { center, rx, ry } = SUBJECT[mode]
  // Same transform as the boat group: heel about the fore-aft axis, then yaw.
  tmpLook
    .copy(center)
    .applyAxisAngle(HEEL_AXIS, -boat.heel)
    .applyAxisAngle(THREE.Object3D.DEFAULT_UP, -boat.heading)
    .add(tmpBoat.set(boat.x, 0, boat.z))
  const needed = Math.max(rx / (tanHalfV * (width / height)), ry / (tanHalfV * (strip / height)))
  tmpOffset.subVectors(tmpPos, tmpLook)
  const current = tmpOffset.length()
  if (needed > current) tmpPos.copy(tmpLook).addScaledVector(tmpOffset, needed / current)
  // Move the render window so the look target lands mid-strip instead of mid-screen.
  camera.setViewOffset(width, height, 0, height / 2 - (top + strip / 2), width, height)
}
