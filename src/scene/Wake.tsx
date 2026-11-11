import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'
import { DEG } from '../sim/math'
import { HULL_LENGTH } from './hullGeometry'
import { WAVE_GLSL } from './Water'

/** Rows of the trail, newest first; at SPACING apart this covers ~33 m of track. */
const MAX_SAMPLES = 96
/** Metres the stern travels before a new row is laid down. */
const SPACING = 0.35
/** Seconds a patch of wake stays visible. */
const LIFE = 9
/** Vertices across each row (−1 … 1), so a wide old wake still bends over the swell. */
const COLS = 5
/** Half-width at the transom (real ILCA transom ~1 m wide). */
const START_HALF = 0.5
/** Kelvin wake half-angle (19.47°, the same for any boat speed): how fast the wake spreads behind the boat. */
const KELVIN = Math.tan(19.47 * DEG)
/** Boat speed (m/s) at which the wake is at full strength; it fades out toward a standstill. */
const FULL_SPEED = 3
/** Above the swell surface, to avoid z-fighting with the water. */
const LIFT = 0.03
/** A row this far from the previous one means the boat was teleported (reset), not sailed. */
const JUMP = 20

const vertex = /* glsl */ `
  uniform float uTime;
  attribute vec3 aWake; // x: across −1 … 1, y: age 0 … 1, z: strength 0 … 1
  varying vec3 vWake;
  varying vec2 vXZ;
  ${WAVE_GLSL}

  void main() {
    vec3 p = position;
    p.y = wave(p.xz, uTime) + ${LIFT.toFixed(2)};
    vWake = aWake;
    vXZ = p.xz;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

const fragment = /* glsl */ `
  varying vec3 vWake;
  varying vec2 vXZ;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    float a = abs(vWake.x);
    float age = vWake.y;
    // Two foam arms along the outer edges (they thin as the wake spreads), churned water right behind the transom,
    // and a faint wash of disturbed water between the arms.
    float arms = smoothstep(mix(0.7, 0.88, age), 0.95, a) * (1.0 - smoothstep(0.95, 1.0, a));
    float core = (1.0 - smoothstep(0.0, 0.45, a)) * (1.0 - smoothstep(0.0, 0.2, age));
    float wash = 0.12 * (1.0 - smoothstep(0.85, 1.0, a));
    // World-anchored froth, so the foam stays put on the water while the boat sails away from it.
    float froth = smoothstep(0.4, 0.75, 0.6 * noise(vXZ * 3.0) + 0.4 * noise(vXZ * 9.0));
    float alpha = ((0.9 * arms + 0.7 * core) * mix(0.1, 1.0, froth) + wash) * pow(1.0 - age, 1.5) * vWake.z;
    gl_FragColor = vec4(vec3(0.93, 0.97, 1.0), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface Sample {
  x: number
  z: number
  /** Unit vector to starboard when laid down. */
  px: number
  pz: number
  speed: number
  born: number
}

function buildRibbon(): THREE.BufferGeometry {
  const idx: number[] = []
  for (let r = 0; r < MAX_SAMPLES; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const a = r * COLS + c
      const b = a + COLS
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  // One row more than MAX_SAMPLES: row 0 is the live stern position.
  const verts = (MAX_SAMPLES + 1) * COLS
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
  g.setAttribute('aWake', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
  g.setIndex(idx)
  g.setDrawRange(0, 0)
  return g
}

/**
 * Foam wake on the water behind the transom: shows the boat moving through the water, not just past the camera.
 * Spreads at the Kelvin angle, fades with age, and scales with the speed the boat had when it made it.
 */
export function Wake() {
  const geometry = useMemo(() => buildRibbon(), [])
  const samples = useMemo<Sample[]>(() => [], [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    uniforms.uTime.value = now
    const { boat } = useSim.getState()
    const sin = Math.sin(boat.heading)
    const cos = Math.cos(boat.heading)
    // Forward is (sin, −cos) in xz, starboard (cos, sin).
    const stern: Sample = { x: boat.x - sin * (HULL_LENGTH / 2), z: boat.z + cos * (HULL_LENGTH / 2), px: cos, pz: sin, speed: boat.speed, born: now }

    const last = samples[0]
    const moved = last ? Math.hypot(stern.x - last.x, stern.z - last.z) : Infinity
    if (moved > JUMP) samples.length = 0
    if (moved >= SPACING) {
      samples.unshift({ ...stern })
      if (samples.length > MAX_SAMPLES) samples.pop()
    }
    while (samples.length && now - samples[samples.length - 1].born > LIFE) samples.pop()

    const pos = geometry.attributes.position.array as Float32Array
    const wake = geometry.attributes.aWake.array as Float32Array
    const rows = [stern, ...samples]
    rows.forEach((s, r) => {
      const age = now - s.born
      const half = START_HALF + age * s.speed * KELVIN
      const strength = THREE.MathUtils.smoothstep(s.speed, 0.2, FULL_SPEED)
      for (let c = 0; c < COLS; c++) {
        const across = (c / (COLS - 1)) * 2 - 1
        const i = (r * COLS + c) * 3
        pos[i] = s.x + s.px * across * half
        pos[i + 2] = s.z + s.pz * across * half
        wake[i] = across
        wake[i + 1] = Math.min(age / LIFE, 1)
        wake[i + 2] = strength
      }
    })
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aWake.needsUpdate = true
    geometry.setDrawRange(0, Math.max(rows.length - 1, 0) * (COLS - 1) * 6)
  })

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
