import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { HEAD_Y, MAST_FOOT_Y, MAST_Z, mastBendAt } from './sailGeometry'

const SEGS = 16
const RADIAL = 8
const RADIUS = 0.032
const SPAR_COLOR = '#8a9099'

/**
 * Mast as a tube along a bent curve. The curve is re-sampled whenever the sim's
 * mastBend changes noticeably, so vang/sheet tension is visible as real bend.
 */
export function Mast() {
  const mesh = useRef<THREE.Mesh>(null)
  const lastBend = useRef(-1)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: SPAR_COLOR, roughness: 0.45, metalness: 0.4 }), [])

  useFrame(() => {
    const { mastBend } = useSim.getState().derived
    if (!mesh.current || Math.abs(mastBend - lastBend.current) < 0.004) return
    lastBend.current = mastBend
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= SEGS; i++) {
      const y = MAST_FOOT_Y + (HEAD_Y + 0.25 - MAST_FOOT_Y) * (i / SEGS)
      pts.push(new THREE.Vector3(0, y, MAST_Z + mastBendAt(y, mastBend)))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const next = new THREE.TubeGeometry(curve, SEGS, RADIUS, RADIAL, false)
    mesh.current.geometry.dispose()
    mesh.current.geometry = next
  })

  return <mesh ref={mesh} material={material} castShadow />
}
