import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'

const COUNT = 60
/** Side of the square around the boat the streaks fill, metres; they wrap inside it as they drift. */
const AREA = 40
const LENGTH = 2.5
const WIDTH = 0.04
/** Just above the wave crests (swell amplitude in Water.tsx peaks at ~0.14 m). */
const Y = 0.18
const OPACITY = 0.55
/** Drift speed as a fraction of the true wind speed; full speed reads as frantic. */
const DRIFT = 0.6

const vertex = /* glsl */ `
  uniform vec2 uBoat;
  uniform vec2 uOffset;
  uniform vec2 uDir;
  uniform float uTime;
  attribute vec3 aSeed; // xy: spot in the area (0…1), z: life phase
  attribute vec2 aUV;   // x: 0 tail … 1 head, y: -1 … 1 across
  varying float vAlong;
  varying float vFade;

  void main() {
    // World-anchored drift, wrapped into a square that follows the boat, so streaks never slide with it.
    vec2 head = aSeed.xy * ${AREA.toFixed(1)} + uOffset;
    vec2 rel = mod(head - uBoat + ${(AREA / 2).toFixed(1)}, ${AREA.toFixed(1)}) - ${(AREA / 2).toFixed(1)};
    vec2 perp = vec2(-uDir.y, uDir.x);
    vec2 p = uBoat + rel + uDir * (aUV.x - 1.0) * ${LENGTH.toFixed(2)} + perp * aUV.y * ${(WIDTH / 2).toFixed(3)};

    float edge = 1.0 - smoothstep(${(AREA * 0.3).toFixed(1)}, ${(AREA * 0.5).toFixed(1)}, length(rel));
    float life = sin(3.14159 * fract(uTime * 0.2 + aSeed.z));
    vAlong = aUV.x;
    vFade = edge * life;
    gl_Position = projectionMatrix * viewMatrix * vec4(p.x, ${Y.toFixed(2)}, p.y, 1.0);
  }
`

const fragment = /* glsl */ `
  varying float vAlong;
  varying float vFade;

  void main() {
    gl_FragColor = vec4(vec3(1.0), ${OPACITY.toFixed(2)} * vAlong * vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** One quad per streak, all in a single geometry; the vertex shader places them each frame. */
function buildStreaks(): THREE.BufferGeometry {
  const seed: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i < COUNT; i++) {
    const s = [Math.random(), Math.random(), Math.random()]
    const corners = [
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 1],
    ]
    for (const c of corners) {
      seed.push(...s)
      uv.push(...c)
    }
    const o = i * 4
    idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3))
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2))
  // Unused by the shader, but three needs a position attribute to know the vertex count.
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(COUNT * 4 * 3), 3))
  g.setIndex(idx)
  return g
}

/**
 * True wind shown as thin streaks drifting downwind across the water around the boat.
 * World-space, so it shows the true wind whatever the boat does.
 */
export function WindStreaks() {
  const geometry = useMemo(() => buildStreaks(), [])
  const uniforms = useMemo(
    () => ({
      uBoat: { value: new THREE.Vector2() },
      uOffset: { value: new THREE.Vector2() },
      uDir: { value: new THREE.Vector2() },
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame((_, dt) => {
    const { boat, wind } = useSim.getState()
    // Downwind = toward bearing fromDir + π; bearing b → world (sin b, -cos b) in xz.
    uniforms.uDir.value.set(-Math.sin(wind.fromDir), Math.cos(wind.fromDir))
    // Integrate the drift here rather than time × speed in the shader, so a wind-speed change doesn't jump every streak.
    const off = uniforms.uOffset.value.addScaledVector(uniforms.uDir.value, wind.speed * DRIFT * dt)
    off.set(off.x % AREA, off.y % AREA)
    uniforms.uBoat.value.set(boat.x, boat.z)
    uniforms.uTime.value = (uniforms.uTime.value + dt) % 1000
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
