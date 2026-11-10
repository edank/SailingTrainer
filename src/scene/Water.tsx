import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '../store'

const SIZE = 600
const SEGMENTS = 120

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;

  // Two long, low swells — calm water that still reads as moving.
  float wave(vec2 p, float t) {
    float h = 0.0;
    h += 0.09 * sin(dot(p, vec2(0.8, 0.35)) * 0.45 + t * 0.7);
    h += 0.05 * sin(dot(p, vec2(-0.3, 1.0)) * 0.8 + t * 1.0);
    return h;
  }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = wave(wp.xz, uTime);
    wp.y += h;
    float e = 0.6;
    float hx = wave(wp.xz + vec2(e, 0.0), uTime);
    float hz = wave(wp.xz + vec2(0.0, e), uTime);
    vNormal = normalize(vec3(h - hx, e, h - hz));
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const fragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec3 uFog;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorld);

    // Flat base colour, lifted toward the sky at grazing angles.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
    vec3 col = mix(uBase, uSky, fres * 0.6);

    // One broad, soft sun highlight.
    vec3 h = normalize(uSun + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 48.0) * 0.22;
    col += spec;

    // Fade into the horizon.
    float dist = distance(cameraPosition, vWorld);
    col = mix(col, uFog, smoothstep(60.0, 240.0, dist));

    gl_FragColor = vec4(col, 1.0);
    // ShaderMaterial doesn't add these itself; without them the linear colour is written raw and looks too dark.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function Water() {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBase: { value: new THREE.Color('#2a6f9e') },
      uSky: { value: new THREE.Color('#2a6f9e') },
      // uSky: { value: new THREE.Color('#9fd0ea') },
      uSun: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
      uFog: { value: new THREE.Color('#cfe6f4') },
    }),
    [],
  )

  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    const { boat } = useSim.getState()
    // Follow the boat so the plane never runs out; waves are world-space so no visible sliding.
    if (mesh.current) mesh.current.position.set(boat.x, 0, boat.z)
  })

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE, SEGMENTS, SEGMENTS]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  )
}
