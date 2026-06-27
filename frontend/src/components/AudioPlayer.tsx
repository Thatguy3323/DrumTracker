import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'


function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function AudioPlayer() {
  const { audioMeta, audioObjectUrl, waveformPeaks, setCurrentTime: setGlobalTime, setIsPlaying: setGlobalPlaying, seekRef } = useApp()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying]       = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]     = useState(0)
  const [dragging, setDragging]     = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  // Register seek function in shared ref so waveform can trigger seek
  useEffect(() => {
    seekRef.current = (t: number) => {
      const el = audioRef.current
      if (!el) return
      el.currentTime = t
      setCurrentTime(t)
      setGlobalTime(t)
    }
    return () => { seekRef.current = null }
  }, [seekRef, setGlobalTime])

  // Sync src when URL changes
  useEffect(() => {
    const el = audioRef.current
    if (!el || !audioObjectUrl) return
    el.src = audioObjectUrl
    el.load()
    setPlaying(false)
    setGlobalPlaying(false)
    setCurrentTime(0)
    setGlobalTime(0)
    setDuration(0)
  }, [audioObjectUrl, setGlobalTime, setGlobalPlaying])

  if (!audioObjectUrl || !audioMeta) return null

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause() } else { el.play() }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const t = ratio * duration
    el.currentTime = t
    setCurrentTime(t)
    setGlobalTime(t)
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const W = 600, H = 36, mid = H / 2

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      padding: '0 24px',
      height: 72,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <audio
        ref={audioRef}
        onPlay={() => { setPlaying(true); setGlobalPlaying(true) }}
        onPause={() => { setPlaying(false); setGlobalPlaying(false) }}
        onEnded={() => { setPlaying(false); setGlobalPlaying(false); setCurrentTime(0); setGlobalTime(0) }}
        onTimeUpdate={() => {
          const t = audioRef.current?.currentTime ?? 0
          setCurrentTime(t)
          setGlobalTime(t)
        }}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        style={{
          width: 40, height: 40,
          borderRadius: '50%',
          background: playing ? 'rgba(0,255,127,0.15)' : 'var(--color-primary)',
          border: playing ? '1px solid var(--color-primary)' : 'none',
          color: playing ? 'var(--color-primary)' : '#000',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Track info */}
      <div style={{ flexShrink: 0, minWidth: 0, maxWidth: 200 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {audioMeta.file_name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {audioMeta.format} · {(audioMeta.sample_rate / 1000).toFixed(1)} kHz ·{' '}
          {audioMeta.channels === 1 ? 'Mono' : 'Stereo'}
        </div>
      </div>

      {/* Time + Waveform scrubber */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {fmt(currentTime)}
        </span>

        <div
          ref={progressRef}
          onClick={seek}
          onMouseDown={() => setDragging(true)}
          onMouseMove={e => { if (dragging) seek(e) }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          style={{ flex: 1, cursor: 'pointer', position: 'relative', height: H }}
        >
          <svg
            width="100%" height={H}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ display: 'block', borderRadius: 4, overflow: 'hidden' }}
          >
            {/* Background fill */}
            <rect x={0} y={0} width={W} height={H} fill="var(--bg-card)" rx={4} />

            {/* Waveform bars */}
            {waveformPeaks.length > 0 ? (
              waveformPeaks.map((p, i) => {
                const bw = W / waveformPeaks.length
                const bh = Math.max(1, p * mid * 0.88)
                const played = i / waveformPeaks.length < progress
                return (
                  <rect
                    key={i}
                    x={i * bw}
                    y={mid - bh}
                    width={Math.max(1, bw - 0.8)}
                    height={bh * 2}
                    fill={played ? 'rgba(0,255,127,0.85)' : 'rgba(255,255,255,0.12)'}
                    rx={0.5}
                  />
                )
              })
            ) : (
              /* fallback plain progress bar if no peaks */
              <>
                <rect x={0} y={mid - 2} width={W} height={4} fill="rgba(255,255,255,0.1)" rx={2} />
                <rect x={0} y={mid - 2} width={progress * W} height={4} fill="var(--color-primary)" rx={2} />
              </>
            )}

            {/* Playhead needle */}
            <rect
              x={progress * W - 1}
              y={0}
              width={2}
              height={H}
              fill="var(--color-primary)"
              opacity={0.9}
            />
          </svg>
        </div>

        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {fmt(duration || audioMeta.duration)}
        </span>
      </div>
    </div>
  )
}
