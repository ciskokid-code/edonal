import { useEffect, useRef, useState } from 'react'

const CHORDS = [
  [110.0, 164.81, 220.0, 329.63],
  [87.31, 130.81, 174.61, 261.63],
  [98.0, 146.83, 196.0, 293.66],
  [82.41, 123.47, 164.81, 246.94],
]
const SPARKLE = [880, 987.77, 1174.66, 1318.51, 1760]
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown']

type Status = 'off' | 'waiting' | 'on'

export function SpaceAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const timers = useRef<number[]>([])
  const unlockRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<Status>('off')

  const removeUnlock = () => {
    if (unlockRef.current) {
      UNLOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, unlockRef.current!))
      unlockRef.current = null
    }
  }

  const start = () => {
    const ctx = new AudioContext()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    masterRef.current = master

    const len = ctx.sampleRate * 5
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    const reverb = ctx.createConvolver()
    reverb.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.9
    reverb.connect(wet)
    wet.connect(master)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.Q.value = 2
    const dry = ctx.createGain()
    dry.gain.value = 0.5
    filter.connect(dry)
    dry.connect(master)
    filter.connect(reverb)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 500
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    const voices: OscillatorNode[][] = CHORDS[0].map((f) =>
      [-7, 7].map((cents, k) => {
        const o = ctx.createOscillator()
        o.type = k === 0 ? 'triangle' : 'sine'
        o.frequency.value = f
        o.detune.value = cents
        const g = ctx.createGain()
        g.gain.value = 0.06
        o.connect(g)
        g.connect(filter)
        o.start()
        return o
      }),
    )

    let idx = 0
    timers.current.push(
      window.setInterval(() => {
        idx = (idx + 1) % CHORDS.length
        voices.forEach((pair, v) =>
          pair.forEach((o) => o.frequency.setTargetAtTime(CHORDS[idx][v], ctx.currentTime, 3)),
        )
      }, 14000),
    )

    timers.current.push(
      window.setInterval(() => {
        if (ctx.state !== 'running' || Math.random() < 0.4) return
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = SPARKLE[Math.floor(Math.random() * SPARKLE.length)]
        const g = ctx.createGain()
        const t = ctx.currentTime
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.05, t + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4)
        o.connect(g)
        g.connect(reverb)
        g.connect(master)
        o.start(t)
        o.stop(t + 4.2)
      }, 3500),
    )

    master.gain.setTargetAtTime(0.6, ctx.currentTime, 1.5)

    if (ctx.state === 'running') {
      setStatus('on')
    } else {
      setStatus('waiting')
      const unlock = () => {
        ctx.resume().then(() => setStatus('on'))
        removeUnlock()
      }
      unlockRef.current = unlock
      UNLOCK_EVENTS.forEach((ev) => window.addEventListener(ev, unlock))
    }
  }

  const stop = () => {
    removeUnlock()
    timers.current.forEach((t) => clearInterval(t))
    timers.current = []
    const ctx = ctxRef.current
    if (!ctx) return
    masterRef.current?.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
    window.setTimeout(() => ctx.close(), 2000)
    ctxRef.current = null
    setStatus('off')
  }

  useEffect(() => {
    start()
    return () => stop()
  }, [])

  const onClick = () => {
    const ctx = ctxRef.current
    if (status === 'waiting' && ctx) {
      ctx.resume().then(() => setStatus('on'))
      removeUnlock()
    } else if (status === 'on') {
      stop()
    } else {
      start()
    }
  }

  const label =
    status === 'on' ? '♪ SOUND ON' : status === 'waiting' ? '♪ TAP ANYWHERE FOR SOUND' : '♪ SOUND OFF'

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
        style={{
          background: 'rgba(255,255,255,.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,.3)',
          borderRadius: 20,
          padding: '8px 16px',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          fontFamily: 'system-ui',
          letterSpacing: '.15em',
        }}
      >
        {label}
      </button>
      <div
        style={{
          color: '#fff',
          opacity: 0.6,
          fontFamily: 'system-ui',
          fontSize: 11,
          letterSpacing: '.2em',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        DOUBLE TAP TO CHANGE COLOR
      </div>
    </div>
  )
}
