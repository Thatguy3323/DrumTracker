import { useState } from 'react'
import { useApp } from '../context/AppContext'

const DRUM_COLORS: Record<string, string> = {
  kick:       '#FF2244',
  snare:      '#00C8FF',
  hihat:      '#00FF41',
  hihat_open: '#44FF88',
  tom_high:   '#FF7A00',
  tom_mid:    '#FF9A40',
  tom_low:    '#FFB870',
  crash:      '#AA44FF',
  ride:       '#FFD700',
}

const DRUM_LABELS: Record<string, string> = {
  kick:       'KICK',
  snare:      'SNARE',
  hihat:      'HH CLOSED',
  hihat_open: 'HH OPEN',
  tom_high:   'TOM HI',
  tom_mid:    'TOM MID',
  tom_low:    'TOM LO',
  crash:      'CRASH',
  ride:       'RIDE',
}

const DRUM_ORDER = ['kick', 'snare', 'hihat', 'hihat_open', 'tom_high', 'tom_mid', 'tom_low', 'crash', 'ride']

const RESOLUTIONS = ['1/4', '1/8', '1/16', '1/32']

function resolveType(raw: string): string {
  if (raw === 'tom') return 'tom_mid'
  if (raw === 'hihat') return 'hihat'
  return raw
}

export default function MapView() {
  const { audioMeta, detectionResult, currentTime, seekRef } = useApp()
  const [resolution, setResolution] = useState('1/16')
  const [swing, setSwing] = useState(0)
  const [zoom, setZoom] = useState(1)

  if (!detectionResult) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 14,
      }}>
        <img src="/drumtracker-logo.png" alt="DrumTracker" style={{ height: 64, opacity: 0.2, marginBottom: 8 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No detection data. Run detection on the DETECT tab first.</div>
      </div>
    )
  }

  const duration = audioMeta?.duration ?? 0
  const ROW_H = 52
  const BASE_W = 1000
  const W = BASE_W * zoom
  const H = DRUM_ORDER.length * ROW_H
  const progress = duration > 0 ? currentTime / duration : 0

  const resolvedHits = detectionResult.hits.map(h => ({ ...h, drum_type: resolveType(h.drum_type) }))

  const hitsByType: Record<string, number> = {}
  resolvedHits.forEach(h => { hitsByType[h.drum_type] = (hitsByType[h.drum_type] ?? 0) + 1 })

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    if (!duration) return
    const rect = svg.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekRef.current?.(ratio * duration)
  }

  const totalHits = detectionResult.total_hits

  const gridLines = resolution === '1/4' ? 4 : resolution === '1/8' ? 8 : resolution === '1/16' ? 16 : 32

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Toolbar ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '7px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        {/* Summary */}
        <span className="panel-label" style={{ whiteSpace: 'nowrap' }}>DRUM MAP</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalHits} events · {duration.toFixed(2)}s
        </span>

        <div style={{ flex: 1 }} />

        {/* Resolution */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>GRID</span>
          <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {RESOLUTIONS.map(r => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                style={{
                  padding: '3px 8px', fontSize: 10, fontWeight: 600,
                  background: resolution === r ? 'var(--color-primary)' : 'transparent',
                  color: resolution === r ? '#000' : 'var(--text-muted)',
                  border: 'none', cursor: 'pointer',
                  borderRight: r !== '1/32' ? '1px solid var(--border)' : 'none',
                  fontFamily: 'inherit',
                }}
              >{r}</button>
            ))}
          </div>
        </div>

        {/* Swing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>SWING</span>
          <input
            type="range" min={0} max={100} step={1} value={swing}
            onChange={e => setSwing(Number(e.target.value))}
            style={{ width: 72, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
          <span className="mono" style={{ fontSize: 10, color: 'var(--color-primary)', minWidth: 28 }}>{swing}%</span>
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>ZOOM</span>
          <input
            type="range" min={0.5} max={4} step={0.1} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: 72, accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
          />
          <span className="mono" style={{ fontSize: 10, color: 'var(--color-secondary)', minWidth: 28 }}>{zoom.toFixed(1)}×</span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, marginLeft: 8 }}>
          {DRUM_ORDER.filter(t => hitsByType[t]).map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: DRUM_COLORS[type], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hitsByType[type]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid area ──────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', minHeight: H + 32 }}>
          {/* Track labels */}
          <div style={{ width: 96, flexShrink: 0, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-panel)' }}>
            {DRUM_ORDER.map((type, ri) => (
              <div
                key={type}
                style={{
                  height: ROW_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 10,
                  borderBottom: '1px solid var(--border)',
                  background: ri % 2 === 0 ? 'var(--bg-panel)' : 'rgba(0,0,0,0.15)',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: 2,
                    background: DRUM_COLORS[type],
                    marginBottom: 2, marginLeft: 'auto',
                  }} />
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
                    color: hitsByType[type] ? DRUM_COLORS[type] : 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}>
                    {DRUM_LABELS[type]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* SVG piano roll */}
          <div style={{ flex: 1, position: 'relative' }}>
            <svg
              width={W}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ display: 'block', height: H, cursor: duration > 0 ? 'pointer' : 'default', width: W }}
              onClick={handleSvgClick}
            >
              {/* Row backgrounds */}
              {DRUM_ORDER.map((type, ri) => {
                const y = ri * ROW_H
                return (
                  <g key={type}>
                    <rect x={0} y={y} width={W} height={ROW_H}
                      fill={ri % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'} />
                    <line x1={0} y1={y + ROW_H} x2={W} y2={y + ROW_H}
                      stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  </g>
                )
              })}

              {/* Grid lines */}
              {Array.from({ length: gridLines }, (_, i) => (
                <line
                  key={i}
                  x1={(i + 1) * W / gridLines} y1={0}
                  x2={(i + 1) * W / gridLines} y2={H}
                  stroke={i % 4 === 3 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}
                  strokeWidth={1}
                />
              ))}

              {/* Hit events */}
              {resolvedHits.map(hit => {
                const ri = DRUM_ORDER.indexOf(hit.drum_type)
                if (ri < 0) return null
                const x = (hit.timestamp / Math.max(duration, 0.001)) * W
                const y = ri * ROW_H
                const hitH = ROW_H - 8
                const alpha = 0.45 + hit.confidence * 0.55
                const color = DRUM_COLORS[hit.drum_type] ?? '#888'
                return (
                  <g key={hit.id}>
                    <rect x={x - 2} y={y + 4} width={4} height={hitH}
                      fill={color} opacity={alpha} rx={1} />
                    <rect x={x - 1} y={y + 4} width={2} height={hitH}
                      fill="white" opacity={alpha * 0.3} rx={0.5} />
                  </g>
                )
              })}

              {/* Playhead */}
              {duration > 0 && (
                <rect x={progress * W - 1} y={0} width={2} height={H}
                  fill="rgba(255,255,255,0.8)" />
              )}
            </svg>

            {/* Time axis */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0', borderTop: '1px solid var(--border)',
              width: W,
            }}>
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i} className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {(duration * i / 10).toFixed(1)}s
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Hit table ──────────────────────────────── */}
        <div style={{ margin: '16px 16px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{
            padding: '7px 14px',
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)',
          }}>
            HIT TABLE — {detectionResult.hits.length} EVENTS
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-panel)', position: 'sticky', top: 0 }}>
                  {['#', 'TIME', 'TYPE', 'VELOCITY', 'CONF', 'FREQ'].map(h => (
                    <th key={h} style={{
                      padding: '5px 12px', textAlign: 'left',
                      fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolvedHits.map((hit, i) => {
                  const color = DRUM_COLORS[hit.drum_type] ?? '#888'
                  return (
                    <tr
                      key={hit.id}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => seekRef.current?.(hit.timestamp)}
                    >
                      <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>{hit.timestamp.toFixed(3)}s</td>
                      <td style={{ padding: '5px 12px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          background: color + '22', color,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {DRUM_LABELS[hit.drum_type] ?? hit.drum_type}
                        </span>
                      </td>
                      <td style={{ padding: '5px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${(hit.velocity / 127) * 100}%`, height: '100%', background: color }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{hit.velocity}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {(hit.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {hit.frequency_centroid ? `${hit.frequency_centroid.toFixed(0)} Hz` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
