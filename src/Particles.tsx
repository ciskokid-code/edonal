import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'

const PALETTES: Record<string, [string, string, string]> = {
  Nebula: ['#1a0536', '#7b2ff7', '#ff9de2'],
  Solar: ['#2b0a00', '#ff5a1f', '#ffe08a'],
  'Deep Sea': ['#001a2c', '#00a6a6', '#c8fff4'],
  Mono: ['#1b1b1b', '#8a8a8a', '#ffffff'],
}

const vertex = /* glsl */ `
uniform float uTime, uSize, uScale, uPR, uSpeed, uPush, uSwirl, uPulseT, uStep, uAttract, uFollow;
uniform vec3 uMouse, uPulseOrigin;
attribute float aRand;
varying float vMix;
varying float vAlpha;

vec3 mod289(vec3 x){return x - floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x - floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
        i.z + vec4(0., i1.z, i2.z, 1.))
      + i.y + vec4(0., i1.y, i2.y, 1.))
      + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2. + 1.;
  vec4 s1 = floor(b1)*2. + 1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  m = m * m;
  return 42. * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 potential(vec3 p, float t) {
  return vec3(
    snoise(p + vec3(0., 0., t)),
    snoise(p + vec3(31.4, 17.1, t)),
    snoise(p + vec3(-47.2, 63.9, t))
  );
}

vec3 curl(vec3 p, float t) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0., 0.), dy = vec3(0., e, 0.), dz = vec3(0., 0., e);
  vec3 x0 = potential(p - dx, t), x1 = potential(p + dx, t);
  vec3 y0 = potential(p - dy, t), y1 = potential(p + dy, t);
  vec3 z0 = potential(p - dz, t), z1 = potential(p + dz, t);
  return vec3(
    (y1.z - y0.z) - (z1.y - z0.y),
    (z1.x - z0.x) - (x1.z - x0.z),
    (x1.y - x0.y) - (y1.x - y0.x)
  ) / (2. * e);
}

void main() {
  vec3 p = position;
  float t = uTime * uSpeed + aRand * 0.5;
  vec3 v = vec3(0.);
  for (int i = 0; i < 12; i++) {
    v = curl(p * uScale, t);
    p += v * uStep;
  }

  p += uMouse * uFollow * (0.3 + aRand);
  vec3 d = p - uMouse;
  float k = exp(-dot(d, d) * 1.2);
  float kw = exp(-dot(d, d) * 0.15);
  p -= d * kw * uAttract;
  p += normalize(d + 1e-4) * k * uPush;
  p += normalize(cross(vec3(0., 0., 1.), d) + 1e-4) * k * uSwirl;

  vec3 o = p - uPulseOrigin;
  float r = length(o);
  float wave = exp(-pow(r - uPulseT * 4., 2.) * 3.) * exp(-uPulseT * 0.9);
  p += normalize(o + 1e-4) * wave * 1.2;

  vMix = clamp(length(v) * 0.35 + aRand * 0.35, 0., 1.);

  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = smoothstep(14., 2., -mv.z);
  vAlpha = (0.25 + 0.75 * aRand) * depth;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.5 + aRand) / -mv.z;
}
`

const fragment = /* glsl */ `
uniform vec3 uC0, uC1, uC2;
varying float vMix;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = pow(smoothstep(0.5, 0., d), 1.5);
  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.5, vMix));
  col = mix(col, uC2, smoothstep(0.5, 1.0, vMix));
  gl_FragColor = vec4(col, soft * vAlpha);
}
`

export function Particles() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const group = useRef<THREE.Group>(null!)
  const target = useRef(new THREE.Vector3())
  const pulseStart = useRef(-99)
  const lastTap = useRef({ t: 0, x: 0, y: 0 })
  const targetColors = useRef([new THREE.Color(), new THREE.Color(), new THREE.Color()])

const [{ count, size, scale, speed, push, swirl, step, palette, attract, follow }, set] = useControls(() => ({
  palette: { options: Object.keys(PALETTES), value: 'Nebula' },
  count: { value: 20000, min: 10000, max: 300000, step: 10000 },
  size: { value: 10, min: 1, max: 40 },
  scale: { value: 0.5, min: 0.1, max: 1.5 },
  speed: { value: 0, min: 0, max: 0.6 },
  step: { value: 0.08, min: 0.02, max: 0.2 },
  push: { value: 0.6, min: 0, max: 3 },
  swirl: { value: 1.2, min: 0, max: 4 },
  attract: { value: 0.5, min: 0, max: 1.5 },
  follow: { value: 0.3, min: 0, max: 1 },
}))


  const paletteRef = useRef(palette)
  paletteRef.current = palette

  const { positions, rands } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const rands = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = Math.cbrt(Math.random()) * 3.2
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      positions.set([
        r * Math.sin(ph) * Math.cos(th),
        r * Math.sin(ph) * Math.sin(th) * 0.7,
        r * Math.cos(ph),
      ], i * 3)
      rands[i] = Math.random()
    }
    return { positions, rands }
  }, [count])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uSize: { value: 10 }, uScale: { value: 0.5 },
    uPR: { value: Math.min(window.devicePixelRatio, 1.75) },
    uSpeed: { value: 0 }, uPush: { value: 0.6 }, uSwirl: { value: 1.2 },
    uStep: { value: 0.08 }, uPulseT: { value: 99 },
    uAttract: { value: 0.5 }, uFollow: { value: 0.3 },
    uMouse: { value: new THREE.Vector3(99, 99, 99) },
    uPulseOrigin: { value: new THREE.Vector3() },
    uC0: { value: new THREE.Color() },
    uC1: { value: new THREE.Color() },
    uC2: { value: new THREE.Color() },
  }), [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const now = performance.now()
      const last = lastTap.current
      const isDouble =
        now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40
      lastTap.current = { t: now, x: e.clientX, y: e.clientY }

      if (isDouble) {
        const names = Object.keys(PALETTES)
        const next = names[(names.indexOf(paletteRef.current) + 1) % names.length]
        set({ palette: next })
        lastTap.current.t = 0
        return
      }

      pulseStart.current = uniforms.uTime.value
      uniforms.uPulseOrigin.value.copy(target.current)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [uniforms, set])

  useFrame((state, dt) => {
    const u = mat.current.uniforms
    u.uTime.value += dt
    u.uSize.value = size
    u.uScale.value = scale
    u.uSpeed.value = speed
    u.uStep.value = step
    u.uPush.value = push
    u.uSwirl.value = swirl
    u.uAttract.value = attract
    u.uFollow.value = follow
    u.uPulseT.value = u.uTime.value - pulseStart.current

    const [c0, c1, c2] = PALETTES[palette]
    const tc = targetColors.current
    tc[0].set(c0)
    tc[1].set(c1)
    tc[2].set(c2)
    const k = 1 - Math.exp(-dt * 3)
    u.uC0.value.lerp(tc[0], k)
    u.uC1.value.lerp(tc[1], k)
    u.uC2.value.lerp(tc[2], k)

    const cam = state.camera
    const dir = new THREE.Vector3(state.pointer.x, state.pointer.y, 0.5)
      .unproject(cam).sub(cam.position).normalize()
    const hit = cam.position.clone().add(dir.multiplyScalar(-cam.position.z / dir.z))
    target.current.lerp(hit, 0.08)
    u.uMouse.value.copy(target.current)

    group.current.rotation.y += dt * 0.03
  })

  return (
    <group ref={group}>
      <points key={count} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aRand" args={[rands, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={mat}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
