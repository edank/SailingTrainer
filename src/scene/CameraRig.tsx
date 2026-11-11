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
  chase: { center: new THREE.Vector3(0, 3.1, 0), rx: 3.2, ry: 3.7 },
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
  useZoomGestures(useThree((s) => s.gl.domElement))

  // Snap on mode change so the transition isn't a slow swoop through the water.
  useEffect(() => {
    first.current = true
  }, [mode])

  useFrame((_, dt) => {
    const { boat, zoom } = useSim.getState()
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
    frameInStrip(camera, mode, boat, zoom, size.width, size.height)
    camera.position.lerp(tmpPos, k)
    camera.up.lerp(tmpUp, k).normalize()
    camera.lookAt(tmpLook)
  })

  return null
}

/**
 * With UI covering the top/bottom of the screen (phones), aim at the subject's centre, back the camera
 * off along its line until the subject fits the uncovered strip, and shift the projection to place it there.
 * Then apply the user's zoom by moving along the same line.
 */
function frameInStrip(camera: THREE.PerspectiveCamera, mode: CameraMode, boat: BoatState, zoom: number, width: number, height: number) {
  const { top, bottom } = viewInsets
  if (top === 0 && bottom === 0) {
    if (camera.view?.enabled) camera.clearViewOffset()
    tmpOffset.subVectors(tmpPos, tmpLook)
    tmpPos.copy(tmpLook).addScaledVector(tmpOffset, 1 / zoom)
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
  const distance = Math.max(needed, current) / zoom
  tmpPos.copy(tmpLook).addScaledVector(tmpOffset, distance / current)
  // When the width is what limits the size (portrait), the strip has spare height: sit the subject on
  // its bottom edge rather than mid-strip, so the boat isn't floating above the dock.
  const halfSubjectPx = (ry / (distance * tanHalfV)) * (height / 2)
  const targetY = Math.max(top + strip / 2, height - bottom - halfSubjectPx)
  // Move the render window so the look target lands at targetY instead of mid-screen.
  camera.setViewOffset(width, height, 0, height / 2 - targetY, width, height)
}

/** Wheel / trackpad zoom per pixel of scroll. */
const WHEEL_ZOOM = 0.004

/** Pinch zoom grows faster than the finger spread (1 = exactly with the fingers). */
const PINCH_GAIN = 1.6

/** Mouse wheel and two-finger pinch on the 3D view drive the store's zoom. */
function useZoomGestures(el: HTMLElement) {
  useEffect(() => {
    const { zoomBy } = useSim.getState()
    const wheel = (e: WheelEvent) => {
      e.preventDefault() // also stops a trackpad pinch from zooming the whole page
      zoomBy(Math.exp(-e.deltaY * WHEEL_ZOOM))
    }
    // Pinch: zoom by how much the distance between two touching pointers changed since the last move.
    const pointers = new Map<number, { x: number; y: number }>()
    let lastSpread = 0
    const spread = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) lastSpread = spread()
    }
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size !== 2) return
      const d = spread()
      if (lastSpread > 0) zoomBy((d / lastSpread) ** PINCH_GAIN)
      lastSpread = d
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      lastSpread = pointers.size === 2 ? spread() : 0
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [el])
}
