import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'

const CHASE_OFFSET = new THREE.Vector3(0, 5.2, 12.5) // behind (+Z local) and above
// Leeward and a little forward of abeam, so the sheeted sail is seen broadside rather than edge-on.
const SAIL_OFFSET = new THREE.Vector3(9.0, 3.2, -4.5) // x is mirrored to the leeward side
const TOP_HEIGHT = 13

const tmpPos = new THREE.Vector3()
const tmpLook = new THREE.Vector3()
const tmpUp = new THREE.Vector3()
const tmpBoat = new THREE.Vector3()

export function CameraRig() {
  const camera = useThree((s) => s.camera)
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
    camera.position.lerp(tmpPos, k)
    camera.up.lerp(tmpUp, k).normalize()
    camera.lookAt(tmpLook)
  })

  return null
}
