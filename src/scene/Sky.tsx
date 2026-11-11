import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SEA_HAZE } from './Water'

/** 0…1: share of the sky covered by cloud. */
const CLOUD_COVER = 0.45
/** Drift of the cloud field in cloud-plane units per second; slow enough to read as weather, not motion. */
const CLOUD_DRIFT = 0.004

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSea;
  uniform vec3 uSun;
  uniform vec3 uCloud;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    // Pale band just above the horizon, then quickly into blue.
    float t = pow(smoothstep(0.0, 0.5, dir.y), 0.6);
    vec3 col = mix(uHorizon, uTop, t);

    // Clouds on a flat layer overhead: the projection squeezes them toward the horizon, like real cloud cover.
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.05) * 1.6 + uTime * vec2(${CLOUD_DRIFT}, ${CLOUD_DRIFT * 0.4});
      float n = fbm(uv);
      float edge = ${(1 - CLOUD_COVER).toFixed(2)};
      float cloud = smoothstep(edge - 0.1, edge + 0.15, n);
      // Thicker parts a little greyer underneath; fade out at the horizon, where the layer turns to noise.
      vec3 cc = mix(uCloud, uCloud * 0.82, smoothstep(0.6, 0.9, n));
      col = mix(col, cc, cloud * 0.9 * smoothstep(0.0, 0.06, dir.y));
    }

    // Hard sea/sky split; below it matches the water's distance haze so the plane's edge doesn't show.
    col = mix(uSea, col, smoothstep(-0.003, 0.003, dir.y));
    float sun = pow(max(dot(dir, uSun), 0.0), 220.0);
    col += vec3(1.0, 0.95, 0.8) * sun;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Gradient dome with a soft cloud layer, centred on the camera every frame so it never runs out. */
export function Sky() {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#1d5fcc') },
      uHorizon: { value: new THREE.Color('#a6cdf2') },
      uSea: { value: new THREE.Color(SEA_HAZE) },
      uSun: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
      uCloud: { value: new THREE.Color('#f2f6fb') },
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame(({ camera, clock }) => {
    mesh.current?.position.copy(camera.position)
    uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[800, 32, 16]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}
