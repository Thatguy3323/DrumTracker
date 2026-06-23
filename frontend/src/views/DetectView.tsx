import { useState, useRef, useEffect, DragEvent } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import AudioPlayer from '../components/AudioPlayer'
import type { TabId } from '../App'

const DRUM_COLORS: Record<string, string> = {
  kick: '#FF2244', snare: '#00C8FF', hihat: '#00FF41', tom: '#FF7A00',
}
const DRUM_ORDER = ['kick', 'snare', 'hihat', 'tom']
const DRUM_LABELS: Record<string, string> = {
  kick: 'KICK', snare: 'SNARE', hihat: 'HI-HAT', tom: 'TOMS',
}

interface Props {
  onNavigateToTab: (tab: TabId) => void
}

export default function DetectView({ onNavigateToTab }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Row 1: Controls ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', height: 200, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <AudioInputPanel />
        <div className="daw-divider-v" />
        <DetectionControlPanel />
        <div className="daw-divider-v" />
        <LevelMeterPanel />
      </div>

      {/* ── Row 2: Visualization ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flex: 1, overflow: 'hidden',
        borderBottom: '1px solid var(--border)',
      }}>
        <DrumMappingGrid />
        <div className="daw-divider-v" />
        <KitPreviewPanel onNavigateToKits={() => onNavigateToTab('kits')} />
      </div>

      {/* ── Row 3: Feedback / Assistant / Export ─────────────────────────── */}
      <div style={{
        display: 'flex', height: 144, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <DetectionFeedbackPanel />
        <div className="daw-divider-v" />
        <AIAssistantPanel onNavigateToTab={onNavigateToTab} />
        <div className="daw-divider-v" />
        <QuickExportPanel />
      </div>

      {/* ── Audio player ─────────────────────────────────────────────────── */}
      <AudioPlayer />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIO INPUT PANEL
═══════════════════════════════════════════════════════════════════════════ */
function AudioInputPanel() {
  const { audioMeta, setAudioMeta, setWaveformPeaks, setAudioObjectUrl, waveformPeaks, detectionResult, currentTime, seekRef } = useApp()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data: meta } = await axios.post('/api/audio/upload', form)
      setAudioMeta(meta)
      setAudioObjectUrl(URL.createObjectURL(file))
      const { data: wf } = await axios.get(`/api/audio/${meta.audio_id}/waveform?points=220`)
      setWaveformPeaks(wf.peaks)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Upload failed')
    } finally { setLoading(false) }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div style={{
      flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      {/* Header */}
      <div className="section-head">
        <span className="panel-label">AUDIO INPUT</span>
        {audioMeta && (
          <>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--color-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {audioMeta.file_name}
            </span>
            <span style={{
              marginLeft: 4, fontSize: 9, padding: '1px 6px',
              background: 'rgba(0,229,204,0.12)', border: '1px solid rgba(0,229,204,0.3)',
              borderRadius: 10, color: 'var(--color-secondary)',
            }}>
              {audioMeta.format.toUpperCase()} · {(audioMeta.sample_rate / 1000).toFixed(1)} kHz · {audioMeta.channels === 1 ? 'Mono' : 'Stereo'}
            </span>
          </>
        )}
        {audioMeta && (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              marginLeft: 'auto', padding: '2px 8px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer',
            }}
          >
            Replace
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <input ref={fileRef} type="file" accept=".wav,.mp3,.flac,.ogg,.aiff" hidden
          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />

        {!audioMeta ? (
          /* Drop zone */
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              background: dragging ? 'rgba(0,255,65,0.04)' : 'transparent',
              border: `2px dashed ${dragging ? 'rgba(0,255,65,0.5)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <img
              src="/drumtracker-logo.png"
              alt="DrumTracker"
              style={{ height: 56, width: 'auto', opacity: 0.28, pointerEvents: 'none', marginBottom: 4 }}
            />
            {loading ? (
              <div style={{ fontSize: 12, color: 'var(--color-primary)' }}>Analyzing…</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Drop audio file or click to browse</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>WAV · MP3 · FLAC · OGG · AIFF</div>
              </>
            )}
            {error && <div style={{ fontSize: 10, color: 'var(--color-error)', marginTop: 4 }}>{error}</div>}
          </div>
        ) : (
          /* Waveform display */
          <MiniWaveform
            waveformPeaks={waveformPeaks}
            duration={audioMeta.duration}
            currentTime={currentTime}
            hits={detectionResult?.hits ?? []}
            onSeek={t => seekRef.current?.(t)}
          />
        )}
      </div>
    </div>
  )
}

function MiniWaveform({
  waveformPeaks, duration, currentTime, hits, onSeek,
}: {
  waveformPeaks: number[]
  duration: number
  currentTime: number
  hits: { timestamp: number; drum_type: string; confidence: number }[]
  onSeek: (t: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 600, H = 96
  const mid = H / 2
  const progress = duration > 0 ? currentTime / duration : 0

  if (!waveformPeaks.length) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 11,
      }}>
        Loading waveform…
      </div>
    )
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !duration) return
    const rect = svgRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <svg
        ref={svgRef}
        width="100%" height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', flex: 1, cursor: duration > 0 ? 'crosshair' : 'default' }}
        onClick={handleClick}
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--bg-panel)" />

        {/* Waveform bars */}
        {waveformPeaks.map((p, i) => {
          const bw = W / waveformPeaks.length
          const bh = Math.max(1, p * mid * 0.88)
          const played = i / waveformPeaks.length < progress
          return (
            <rect
              key={i}
              x={i * bw}
              y={mid - bh}
              width={Math.max(0.8, bw - 0.8)}
              height={bh * 2}
              fill={played ? 'rgba(0,229,204,0.85)' : 'rgba(0,229,204,0.22)'}
              rx={0.5}
            />
          )
        })}

        {/* Center line */}
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

        {/* Hit markers */}
        {duration > 0 && hits.map((hit, i) => {
          const x = (hit.timestamp / duration) * W
          const color = DRUM_COLORS[hit.drum_type] ?? '#fff'
          const alpha = 0.5 + hit.confidence * 0.5
          return (
            <line
              key={i}
              x1={x} y1={4} x2={x} y2={H - 4}
              stroke={color} strokeWidth={1.2} opacity={alpha}
            />
          )
        })}

        {/* Playhead */}
        {duration > 0 && (
          <rect
            x={progress * W - 1} y={0}
            width={2} height={H}
            fill="rgba(255,255,255,0.85)"
          />
        )}
      </svg>

      {/* Legend row */}
      {hits.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '4px 10px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}>
          {DRUM_ORDER.map(type => {
            const count = hits.filter(h => h.drum_type === type).length
            if (!count) return null
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 2, height: 10, background: DRUM_COLORS[type], display: 'inline-block', opacity: 0.9 }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
                <span style={{ fontSize: 9, color: DRUM_COLORS[type], fontWeight: 700 }}>{count}</span>
              </div>
            )
          })}
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>
            {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETECTION CONTROL PANEL
═══════════════════════════════════════════════════════════════════════════ */
function DetectionControlPanel() {
  const { audioMeta, detectionResult, setDetectionResult } = useApp()
  const [sensitivity, setSensitivity] = useState(0.7)
  const [threshold, setThreshold]     = useState(-18)
  const [preFilter, setPreFilter]     = useState(15)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function detect() {
    if (!audioMeta) return
    setLoading(true); setError('')
    try {
      const { data } = await axios.post('/api/detection/detect', {
        audio_id: audioMeta.audio_id,
        sensitivity,
        threshold,
        pre_filter: preFilter,
        classification_mode: 'default',
      })
      setDetectionResult(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Detection failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      flex: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head">
        <span className="panel-label">DETECTION</span>
        {detectionResult && (
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
            color: 'var(--color-primary)',
            padding: '1px 6px', background: 'rgba(0,255,65,0.1)',
            border: '1px solid rgba(0,255,65,0.3)', borderRadius: 10,
          }}>
            {detectionResult.total_hits} HITS
          </span>
        )}
      </div>

      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        <DawSlider
          label="SENSITIVITY"
          value={sensitivity} min={0.1} max={1.0} step={0.01}
          display={sensitivity.toFixed(2)}
          color="var(--color-primary)"
          onChange={setSensitivity}
        />
        <DawSlider
          label="THRESHOLD"
          value={threshold} min={-40} max={-3} step={0.5}
          display={`${threshold} dB`}
          color="var(--color-secondary)"
          onChange={setThreshold}
        />
        <DawSlider
          label="RETRIGGER FILTER"
          value={preFilter} min={5} max={30} step={1}
          display={`${preFilter} ms`}
          color="var(--color-tertiary)"
          onChange={setPreFilter}
        />

        <button
          onClick={detect}
          disabled={loading || !audioMeta}
          style={{
            marginTop: 'auto',
            padding: '9px 12px',
            background: loading ? 'rgba(0,255,65,0.06)' : audioMeta ? 'rgba(0,255,65,0.14)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${audioMeta ? 'rgba(0,255,65,0.5)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            color: audioMeta ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
            cursor: loading || !audioMeta ? 'not-allowed' : 'pointer',
            boxShadow: audioMeta && !loading ? '0 0 14px rgba(0,255,65,0.1)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {loading ? (
            <>
              <Spinner />
              ANALYZING…
            </>
          ) : (
            <>◎ AUTO DETECT</>
          )}
        </button>

        {!audioMeta && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
            Load audio first
          </div>
        )}

        {error && (
          <div style={{ fontSize: 10, color: 'var(--color-error)', padding: '5px 8px', background: 'rgba(255,34,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function DawSlider({ label, value, min, max, step, display, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; color: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span className="panel-label">{label}</span>
        <span className="mono" style={{ fontSize: 10, fontWeight: 700, color }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color }}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEVEL METER PANEL
═══════════════════════════════════════════════════════════════════════════ */
function LevelMeterPanel() {
  const { waveformPeaks, audioMeta } = useApp()
  const avgLevel = waveformPeaks.length > 0
    ? waveformPeaks.reduce((a, b) => a + b, 0) / waveformPeaks.length
    : 0
  const peakLevel = waveformPeaks.length > 0 ? Math.max(...waveformPeaks) : 0

  const lLevel = audioMeta ? Math.min(1, avgLevel * 1.2) : 0
  const rLevel = audioMeta ? Math.min(1, avgLevel * 1.05) : 0

  return (
    <div style={{
      width: 88, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head" style={{ justifyContent: 'center' }}>
        <span className="panel-label">LEVEL</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, padding: '10px 14px' }}>
        <VUBar level={lLevel} peak={peakLevel} label="L" />
        <VUBar level={rLevel} peak={peakLevel * 0.95} label="R" />
      </div>
    </div>
  )
}

function VUBar({ level, peak, label }: { level: number; peak: number; label: string }) {
  const SEGMENTS = 16
  const segColors = Array.from({ length: SEGMENTS }, (_, i) => {
    const threshold = i / SEGMENTS
    const active = threshold < level
    if (threshold > 0.85) return active ? '#FF2244' : 'rgba(255,34,68,0.12)'
    if (threshold > 0.65) return active ? '#FF9500' : 'rgba(255,149,0,0.12)'
    return active ? '#00FF41' : 'rgba(0,255,65,0.1)'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2, height: 100 }}>
        {segColors.map((color, i) => (
          <div
            key={i}
            style={{
              width: 14, height: 4,
              background: color,
              borderRadius: 1,
              transition: 'background 0.05s ease',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4, fontWeight: 700, letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DRUM MAPPING GRID (ROW 2 LEFT)
═══════════════════════════════════════════════════════════════════════════ */
function DrumMappingGrid() {
  const { audioMeta, detectionResult, currentTime, seekRef } = useApp()
  const duration = audioMeta?.duration ?? 0
  const progress = duration > 0 ? currentTime / duration : 0
  const W = 1000
  const ROW_H = 32

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekRef.current?.(ratio * duration)
  }

  return (
    <div style={{
      flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      <div className="section-head">
        <span className="panel-label">DRUM MAP</span>
        {detectionResult && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6 }}>
            {detectionResult.total_hits} events · {duration.toFixed(2)}s
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          {DRUM_ORDER.map(type => {
            const count = detectionResult?.hits_by_type[type] ?? 0
            if (!count) return null
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: DRUM_COLORS[type], display: 'inline-block' }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
                <span style={{ fontSize: 9, color: DRUM_COLORS[type], fontWeight: 700 }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Track labels */}
        <div style={{ width: 62, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
          {DRUM_ORDER.map(type => (
            <div
              key={type}
              style={{
                height: ROW_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 8,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'var(--bg-panel)',
              }}
            >
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
                color: DRUM_COLORS[type], textTransform: 'uppercase',
              }}>
                {DRUM_LABELS[type]}
              </span>
            </div>
          ))}
        </div>

        {/* SVG piano roll */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${ROW_H * DRUM_ORDER.length}`}
            preserveAspectRatio="none"
            style={{
              display: 'block',
              height: ROW_H * DRUM_ORDER.length,
              cursor: duration > 0 ? 'crosshair' : 'default',
            }}
            onClick={handleSvgClick}
          >
            {/* Row backgrounds */}
            {DRUM_ORDER.map((type, ri) => (
              <g key={type}>
                <rect
                  x={0} y={ri * ROW_H} width={W} height={ROW_H}
                  fill={ri % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}
                />
                <line x1={0} y1={(ri + 1) * ROW_H} x2={W} y2={(ri + 1) * ROW_H}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              </g>
            ))}

            {/* Bar grid lines */}
            {Array.from({ length: 9 }, (_, i) => (
              <line
                key={i}
                x1={(i + 1) * W / 10} y1={0}
                x2={(i + 1) * W / 10} y2={ROW_H * DRUM_ORDER.length}
                stroke="rgba(255,255,255,0.03)" strokeWidth={1}
              />
            ))}

            {/* Hits */}
            {detectionResult && duration > 0 && detectionResult.hits.map((hit, idx) => {
              const ri = DRUM_ORDER.indexOf(hit.drum_type)
              if (ri < 0) return null
              const x = (hit.timestamp / duration) * W
              const y = ri * ROW_H
              const alpha = 0.45 + hit.confidence * 0.55
              const color = DRUM_COLORS[hit.drum_type]
              return (
                <rect
                  key={idx}
                  x={x - 2} y={y + 3}
                  width={4} height={ROW_H - 6}
                  fill={color} opacity={alpha} rx={1}
                />
              )
            })}

            {/* Playhead */}
            {duration > 0 && (
              <rect
                x={progress * W - 1} y={0}
                width={2} height={ROW_H * DRUM_ORDER.length}
                fill="rgba(255,255,255,0.75)"
              />
            )}
          </svg>

          {/* Empty state */}
          {!detectionResult && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 11,
              pointerEvents: 'none',
            }}>
              {audioMeta ? 'Run detection to populate the drum map' : 'Load audio to get started'}
            </div>
          )}
        </div>
      </div>

      {/* Time axis */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '3px 62px 3px 62px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="mono" style={{ fontSize: 8, color: 'var(--text-muted)' }}>
            {(duration * i / 5).toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   KIT PREVIEW PANEL (ROW 2 RIGHT)
═══════════════════════════════════════════════════════════════════════════ */
const KITS = [
  { id: 'rock',       name: 'Rock Standard',  color: '#FF2244', icon: '🥁' },
  { id: 'jazz',       name: 'Jazz Brushes',   color: '#FF7A00', icon: '🎷' },
  { id: 'electronic', name: 'Electronic 808', color: '#00C8FF', icon: '⚡' },
  { id: 'hiphop',     name: 'Hip-Hop SP',     color: '#00FF41', icon: '🎤' },
  { id: 'metal',      name: 'Metal Blast',    color: '#AA44FF', icon: '🤘' },
  { id: 'latin',      name: 'Latin Perc.',    color: '#FFD700', icon: '🎵' },
]

function KitPreviewPanel({ onNavigateToKits }: { onNavigateToKits: () => void }) {
  const { selectedKit } = useApp()
  const kit = KITS.find(k => k.id === selectedKit)

  return (
    <div style={{
      width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head">
        <span className="panel-label">KIT</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', gap: 10 }}>
        {kit ? (
          <>
            <div style={{ fontSize: 36 }}>{kit.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', textAlign: 'center' }}>{kit.name}</div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: kit.color,
              boxShadow: `0 0 10px ${kit.color}60`,
            }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'KICK', note: 'C2', color: '#FF2244' },
                { label: 'SNARE', note: 'D2', color: '#00C8FF' },
                { label: 'HIHAT', note: 'F#2', color: '#00FF41' },
                { label: 'TOM', note: 'A2', color: '#FF7A00' },
              ].map(n => (
                <div key={n.label} style={{
                  padding: '2px 6px', borderRadius: 3,
                  background: n.color + '18', border: `1px solid ${n.color}40`,
                  fontSize: 8, color: n.color, fontWeight: 700,
                }}>
                  {n.label} {n.note}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <img src="/drumtracker-logo.png" alt="" style={{ height: 36, opacity: 0.18, marginBottom: 4 }} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>No kit selected</div>
          </>
        )}

        <button
          onClick={onNavigateToKits}
          style={{
            marginTop: 4,
            padding: '5px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: 10, cursor: 'pointer',
          }}
        >
          {kit ? 'Change Kit' : 'Select Kit →'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETECTION FEEDBACK PANEL (ROW 3 LEFT)
═══════════════════════════════════════════════════════════════════════════ */
function DetectionFeedbackPanel() {
  const { detectionResult } = useApp()

  return (
    <div style={{
      flex: 2.5, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head">
        <span className="panel-label">DETECTION FEEDBACK</span>
        {detectionResult && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>
            {(detectionResult.confidence * 100).toFixed(0)}% avg confidence · {detectionResult.processing_time.toFixed(2)}s
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 12 }}>
        {!detectionResult ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            Detection results will appear here
          </div>
        ) : (
          <>
            {/* Per-type stats */}
            <div style={{ flex: 1, display: 'flex', gap: 10 }}>
              {DRUM_ORDER.map(type => {
                const count = detectionResult.hits_by_type[type] ?? 0
                const pct = detectionResult.total_hits > 0
                  ? Math.round((count / detectionResult.total_hits) * 100)
                  : 0
                const color = DRUM_COLORS[type]
                return (
                  <div
                    key={type}
                    style={{
                      flex: 1, padding: '8px 10px',
                      background: 'var(--bg-card)',
                      border: `1px solid ${color}30`,
                      borderRadius: 'var(--radius)',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.08em' }}>
                        {DRUM_LABELS[type]}
                      </span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color }}>
                        {count}
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{pct}% of hits</span>
                  </div>
                )
              })}
            </div>

            {/* Overall gauge */}
            <div style={{
              width: 60, flexShrink: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
            }}>
              <ConfidenceRing value={detectionResult.confidence} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>OVERALL</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const pct = Math.round(value * 100)
  const fill = circ * value

  return (
    <svg width={54} height={54} viewBox="0 0 54 54">
      <circle cx={27} cy={27} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle
        cx={27} cy={27} r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform="rotate(-90 27 27)"
      />
      <text
        x={27} y={31}
        textAnchor="middle"
        fontSize={11} fontWeight={700}
        fill="var(--color-primary)"
        fontFamily="monospace"
      >
        {pct}%
      </text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI ASSISTANT PANEL (ROW 3 CENTER)
═══════════════════════════════════════════════════════════════════════════ */
function AIAssistantPanel({ onNavigateToTab }: { onNavigateToTab: (tab: TabId) => void }) {
  const { audioMeta, detectionResult, selectedKit } = useApp()

  let tip: { icon: string; title: string; body: string; action?: { label: string; tab: TabId } } | null = null

  if (!audioMeta) {
    tip = {
      icon: '◈',
      title: 'Load Audio',
      body: 'Drop a WAV, MP3, or FLAC file into the Audio Input panel to get started.',
    }
  } else if (!detectionResult) {
    tip = {
      icon: '◎',
      title: 'Detect Hits',
      body: 'Audio loaded. Adjust sensitivity and click Auto Detect to find drum transients.',
    }
  } else if (!selectedKit) {
    tip = {
      icon: '◉',
      title: 'Select a Kit',
      body: `${detectionResult.total_hits} hits detected. Choose a drum kit to shape your MIDI velocity curves.`,
      action: { label: 'Open Kit Manager →', tab: 'kits' },
    }
  } else {
    tip = {
      icon: '↗',
      title: 'Session Ready',
      body: `${detectionResult.total_hits} hits · kit selected. Export your MIDI file or view the full drum map.`,
      action: { label: 'Export MIDI →', tab: 'export' },
    }
  }

  return (
    <div style={{
      flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head">
        <span className="panel-label">ASSISTANT</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10 }}>
        {tip && (
          <>
            <div style={{ fontSize: 22, opacity: 0.6, flexShrink: 0 }}>{tip.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-primary)', marginBottom: 3 }}>
                {tip.title}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {tip.body}
              </div>
              {tip.action && (
                <button
                  onClick={() => onNavigateToTab(tip!.action!.tab)}
                  style={{
                    marginTop: 6,
                    background: 'transparent', border: 'none',
                    color: 'var(--color-primary)', fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', padding: 0, letterSpacing: '0.04em',
                  }}
                >
                  {tip.action.label}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK EXPORT PANEL (ROW 3 RIGHT)
═══════════════════════════════════════════════════════════════════════════ */
function QuickExportPanel() {
  const { detectionResult } = useApp()
  const [tempo, setTempo]       = useState(120)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported]  = useState(false)
  const [error, setError]        = useState('')

  async function exportMidi() {
    if (!detectionResult) return
    setExporting(true); setError('')
    try {
      const res = await axios.get(
        `/api/export/midi/${detectionResult.detection_id}?tempo=${tempo}`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([res.data], { type: 'audio/midi' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `drumtracker_${detectionResult.detection_id.slice(0, 8)}.mid`
      a.click()
      URL.revokeObjectURL(url)
      setExported(true)
    } catch {
      setError('Export failed.')
    } finally { setExporting(false) }
  }

  return (
    <div style={{
      flex: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-panel)',
    }}>
      <div className="section-head">
        <span className="panel-label">EXPORT</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 14px', gap: 8 }}>
        {/* Tempo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="panel-label">TEMPO</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700 }}>{tempo} BPM</span>
          </div>
          <input
            type="range" min={40} max={240} step={1} value={tempo}
            onChange={e => setTempo(+e.target.value)}
          />
        </div>

        {/* Export button */}
        <button
          onClick={exportMidi}
          disabled={exporting || !detectionResult}
          style={{
            padding: '8px',
            background: detectionResult
              ? (exporting ? 'rgba(0,255,65,0.06)' : 'rgba(0,255,65,0.15)')
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${detectionResult ? 'rgba(0,255,65,0.5)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            color: detectionResult ? 'var(--color-primary)' : 'var(--text-muted)',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.07em',
            cursor: !detectionResult || exporting ? 'not-allowed' : 'pointer',
            boxShadow: detectionResult && !exporting ? '0 0 12px rgba(0,255,65,0.1)' : 'none',
          }}
        >
          {exporting ? '⏳ GENERATING…' : exported ? '✓ DOWNLOAD AGAIN' : '↗ EXPORT MIDI'}
        </button>

        {error && <div style={{ fontSize: 9, color: 'var(--color-error)' }}>{error}</div>}

        {exported && (
          <div style={{ fontSize: 9, color: 'var(--color-primary)' }}>✓ Exported to MIDI</div>
        )}

        {!detectionResult && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
            Run detection first
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED UTILITIES
═══════════════════════════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, flexShrink: 0,
      border: '2px solid rgba(0,255,65,0.2)', borderTopColor: 'var(--color-primary)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}
