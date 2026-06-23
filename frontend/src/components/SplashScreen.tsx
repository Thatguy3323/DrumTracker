import { useEffect, useState } from 'react'

const TOTAL = 5600

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const steps = [
      { delay: 0,    next: 1 },
      { delay: 550,  next: 2 },
      { delay: 850,  next: 3 },
      { delay: 800,  next: 4 },
      { delay: 750,  next: 5 },
      { delay: 800,  next: 6 },
      { delay: 900,  next: 7 },
      { delay: 700,  next: 8 },
    ]
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0
    steps.forEach(s => {
      elapsed += s.delay
      timers.push(setTimeout(() => setStage(s.next), elapsed))
    })
    timers.push(setTimeout(onDone, TOTAL))
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const opacity =
    stage === 0 ? 0 :
    stage === 1 ? 0.45 :
    stage === 2 ? 0.78 :
    stage >= 3 && stage <= 6 ? 1 :
    stage === 7 ? 1 : 0

  const logoFilter =
    stage === 1 ? 'drop-shadow(0 0 18px rgba(0,200,255,0.5))' :
    stage === 2 ? 'drop-shadow(0 0 28px rgba(0,200,255,0.6)) drop-shadow(0 0 12px rgba(0,255,65,0.3))' :
    stage === 3 ? 'drop-shadow(0 0 32px rgba(0,255,65,0.7)) drop-shadow(0 0 16px rgba(0,200,255,0.4))' :
    stage === 4 ? 'drop-shadow(0 0 48px rgba(0,255,65,0.9)) brightness(1.15)' :
    stage === 5 ? 'drop-shadow(0 0 24px rgba(0,200,255,0.5)) brightness(1.05)' :
    stage === 6 ? 'drop-shadow(0 0 20px rgba(0,255,65,0.45))' :
    stage === 7 ? 'drop-shadow(0 0 60px rgba(255,255,255,1)) brightness(3)' : 'none'

  const ringOpacity =
    stage === 0 ? 0 :
    stage === 1 ? 0.2 :
    stage === 2 ? 0.5 :
    stage >= 3 && stage <= 6 ? 1 :
    stage === 7 ? 0.8 : 0

  const ringRotate = stage >= 3 ? `${(stage - 2) * 90}deg` : '0deg'

  const textOpacity = stage >= 5 && stage <= 6 ? 1 : 0

  const flashOpacity = stage === 7 ? 1 : 0

  const bgColor =
    stage === 7 ? '#ffffff' :
    stage === 8 ? '#0F0F1A' :
    '#0F0F1A'

  const overlayOpacity = stage === 8 ? 0 : 1

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: bgColor,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 0,
        opacity: overlayOpacity,
        transition: stage === 8 ? 'opacity 0.5s ease' : 'background 0.15s ease',
        pointerEvents: 'all',
      }}
    >
      {/* Ring */}
      <div
        style={{
          position: 'relative',
          width: 240, height: 240,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg
          width="240" height="240"
          style={{
            position: 'absolute', inset: 0,
            opacity: ringOpacity,
            transform: `rotate(${ringRotate})`,
            transition: 'opacity 0.5s ease, transform 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
          viewBox="0 0 240 240"
        >
          <defs>
            <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C8FF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#00FF41" stopOpacity="1" />
              <stop offset="100%" stopColor="#00C8FF" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <circle
            cx="120" cy="120" r="108"
            stroke="url(#rg1)" strokeWidth="1.5" fill="none"
            strokeDasharray="678" strokeDashoffset={stage < 3 ? 480 : 0}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
          />
          {stage >= 3 && [0, 60, 120, 180, 240, 300].map((angle, i) => (
            <circle
              key={i}
              cx={120 + 108 * Math.cos((angle * Math.PI) / 180)}
              cy={120 + 108 * Math.sin((angle * Math.PI) / 180)}
              r="2.5"
              fill={i % 2 === 0 ? '#00FF41' : '#00C8FF'}
              opacity={0.7}
            />
          ))}
        </svg>

        <img
          src="/drumtracker-logo.png"
          alt="DrumTracker"
          style={{
            width: 170, height: 'auto',
            opacity,
            filter: logoFilter,
            transform: stage >= 4 && stage <= 5 ? 'scale(1.04)' : 'scale(1)',
            transition: 'opacity 0.55s ease, filter 0.55s ease, transform 0.4s ease',
          }}
        />
      </div>

      {/* Wordmark */}
      <div
        style={{
          marginTop: 28,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 22, fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#E2E8F0',
          opacity: textOpacity,
          transform: textOpacity ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          textShadow: '0 0 24px rgba(0,255,65,0.4)',
        }}
      >
        DRUM<span style={{ color: '#00FF41' }}>TRACKER</span>
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 7,
          fontSize: 10,
          letterSpacing: '0.22em',
          color: '#475569',
          fontWeight: 600,
          opacity: textOpacity,
          transition: 'opacity 0.7s ease 0.1s',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        AUDIO IN · MIDI OUT
      </div>

      {/* Loading bar */}
      <div style={{
        marginTop: 36,
        width: 180, height: 2,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 2,
        overflow: 'hidden',
        opacity: stage >= 1 && stage <= 6 ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, stage * 14.5)}%`,
          background: 'linear-gradient(90deg, #00C8FF, #00FF41)',
          borderRadius: 2,
          transition: 'width 0.55s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 8px rgba(0,255,65,0.5)',
        }} />
      </div>

      {/* White flash overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'white',
        opacity: flashOpacity,
        transition: 'opacity 0.12s ease',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
