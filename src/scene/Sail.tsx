import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { bulgeAt, sailFrame, sailPoint } from './sailGeometry'

const NU = 12 // chord-wise segments
const NV = 18 // height-wise segments

/**
 * Parametric mainsail driven by the sim: boom angle + lift, mast bend, twist, camber,
 * draft position, luffing. Rebuilt every frame (~250 verts) — cheap and always honest to the model.
 */
export function Sail() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, NU, NV)
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((NU + 1) * (NV + 1) * 3), 3))
    return g
  }, [])
  const timeRef = useRef(0)

  useFrame((_, dt) => {
    timeRef.current += dt
    const d = useSim.getState().derived
    const arr = geom.attributes.position.array as Float32Array
    let p = 0
    for (let j = 0; j <= NV; j++) {
      const f = sailFrame(j / NV, d)
      for (let i = 0; i <= NU; i++) {
        const u = i / NU
        sailPoint(u, f, bulgeAt(u, f, d, timeRef.current), arr, p)
        p += 3
      }
    }
    geom.attributes.position.needsUpdate = true
    geom.computeVertexNormals()
  })

  return (
    <mesh geometry={geom} castShadow>
      {/* A touch of emissive keeps the shaded face reading as white cloth, not grey */}
      <meshStandardMaterial color="#f4f1e8" emissive="#f4f1e8" emissiveIntensity={0.22} side={THREE.DoubleSide} roughness={0.9} metalness={0} />
    </mesh>
  )
}
