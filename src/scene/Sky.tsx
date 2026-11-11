import { useMemo } from 'react'
import * as THREE from 'three'

/** Colour the water fades to in the distance; the sky uses it below the horizon. */
export const SEA_HAZE = '#4f8fbf'

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
  varying vec3 vDir;
  void main() {
    // Pale band just above the horizon, then quickly into blue.
    float t = pow(smoothstep(0.0, 0.5, vDir.y), 0.6);
    vec3 col = mix(uHorizon, uTop, t);
    // Hard sea/sky split; below it matches the water's distance haze so the plane's edge doesn't show.
    col = mix(uSea, col, smoothstep(-0.003, 0.003, vDir.y));
    float sun = pow(max(dot(normalize(vDir), uSun), 0.0), 220.0);
    col += vec3(1.0, 0.95, 0.8) * sun;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Gradient dome that follows the camera (large radius, never culled). */
export function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#1d5fcc') },
      uHorizon: { value: new THREE.Color('#a6cdf2') },
      uSea: { value: new THREE.Color(SEA_HAZE) },
      uSun: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
    }),
    [],
  )
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[800, 24, 12]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}
