import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { Particles } from './Particles'
import { SpaceAudio } from './SpaceAudio'

export default function App() {
  return (
    <>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6], fov: 55 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{ position: 'fixed', inset: 0, background: '#02030a' }}
      >
        <Particles />
        <EffectComposer>
          <Bloom intensity={0.7} luminanceThreshold={0.15} mipmapBlur />
          <Noise opacity={0.04} />
          <Vignette eskil={false} offset={0.2} darkness={0.9} />
        </EffectComposer>
      </Canvas>

      <SpaceAudio />
    </>
  )
}
