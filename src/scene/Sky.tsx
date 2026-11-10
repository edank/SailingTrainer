import { useMemo } from 'react'
import * as THREE from 'three'

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
  uniform vec3 uSun;
  varying vec3 vDir;
  void main() {
    float t = smoothstep(-0.05, 0.45, vDir.y);
    vec3 col = mix(uHorizon, uTop, t);
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
      uTop: { value: new THREE.Color('#4f93d6') },
      uHorizon: { value: new THREE.Color('#cfe6f4') },
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
