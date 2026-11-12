import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { bulgeAt, chordAt, FOOT, sailFrame, sailPoint } from './sailGeometry'
import { makeSailTexture } from './sailTexture'

const NU = 12 // chord-wise segments
const NV = 18 // height-wise segments

/** White cloth; a touch of emissive keeps the shaded face reading as white, not grey. */
function clothMaterial(side: 'port' | 'starboard'): THREE.MeshStandardMaterial {
  const map = makeSailTexture(side)
  return new THREE.MeshStandardMaterial({
    map,
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: 0.22,
    roughness: 0.9,
    metalness: 0,
    // The plane's front face points to starboard (+X) with the boom centred.
    side: side === 'starboard' ? THREE.FrontSide : THREE.BackSide,
  })
}

/**
 * Parametric mainsail driven by the sim: boom angle + lift, mast bend, twist, camber,
 * draft position, luffing. Rebuilt every frame (~250 verts) — cheap and always honest to the model.
 * Drawn as two single-sided meshes so the sail numbers and insignia read correctly from both sides.
 */
export function Sail() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, NU, NV)
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((NU + 1) * (NV + 1) * 3), 3))
    // Metric UVs (x = metres aft of the luff / FOOT) so the artwork keeps its proportions as the chord narrows.
    const uv = new Float32Array((NU + 1) * (NV + 1) * 2)
    let p = 0
    for (let j = 0; j <= NV; j++) {
      const c = chordAt(j / NV)
      for (let i = 0; i <= NU; i++) {
        uv[p++] = ((i / NU) * c) / FOOT
        uv[p++] = j / NV
      }
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    return g
  }, [])
  const starboard = useMemo(() => clothMaterial('starboard'), [])
  const port = useMemo(() => clothMaterial('port'), [])
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
    <>
      <mesh geometry={geom} material={starboard} castShadow />
      <mesh geometry={geom} material={port} />
    </>
  )
}
