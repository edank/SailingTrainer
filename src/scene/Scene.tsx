import { Canvas, useFrame } from '@react-three/fiber'
import { useSim } from '../store'
import { Boat } from './Boat'
import { CameraRig } from './CameraRig'
import { Sky } from './Sky'
import { Water } from './Water'
import { WindStreaks } from './WindStreaks'
import { useInput } from '../hooks/useInput'

/** Drives the simulation from the render loop and applies held-key input. */
function SimLoop() {
  const input = useInput()
  useFrame((_, dt) => {
    input.apply(dt)
    useSim.getState().tick(dt)
  })
  return null
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.1, far: 2000, position: [0, 4, 10] }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Sky />
      <hemisphereLight args={['#dbeeff', '#2a5a7a', 0.9]} />
      {/* Fill from the opposite side so the shaded face of the sail still reads as white cloth */}
      <directionalLight position={[-40, 30, 50]} intensity={0.9} />
      <directionalLight
        position={[40, 70, -50]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={10}
        shadow-camera-far={150}
      />
      <Water />
      <WindStreaks />
      <Boat />
      <CameraRig />
      <SimLoop />
    </Canvas>
  )
}
