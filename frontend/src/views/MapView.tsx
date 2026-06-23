import { useApp } from '../context/AppContext'

const DRUM_COLORS: Record<string, string> = {
  kick: '#FF2244', snare: '#00C8FF', hihat: '#00FF41', tom: '#FF7A00',
}
const DRUM_ORDER = ['kick', 'snare', 'hihat', 'tom']

export default function MapView() {
  const { audioMeta, detectionResult, currentTime, seekRef } = useApp()

  if (!detectionResult) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 14,
      }}>
        <div style={{ fontSize: 52, opacity: 0.15 }}>⊞</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No detection data. Run detection on the DETECT tab first.</div>
      </div>
    )
  }

  const duration = audioMeta?.duration ?? 0
  const W = 1000
  const ROW_H = 64
  const H = DRUM_ORDER.length * ROW_H
  const progress = duration > 0 ? currentTime / duration : 0

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    if (!duration) return
    const rect = svg.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekRef.current?.(ratio * duration)
  }

  const totalHits = detectionResult.total_hits

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="panel-label">DRUM MAP</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {totalHits} events · {duration.toFixed(2)}s
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {DRUM_ORDER.map(type => {
            const count = detectionResult.hits_by_type[type] ?? 0
            if (!count) return null
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: DRUM_COLORS[type], display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
                <span style={{ fontSize: 10, color: DRUM_COLORS[type], fontWeight: 700 }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 20px' }}>
        {/* Track rows */}
        <div style={{ display: 'flex', minHeight: H + 40 }}>
          {/* Track labels */}
          <div style={{ width: 80, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            {DRUM_ORDER.map(type => (
              <div
                key={type}
                style={{
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 12,
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-panel)',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: DRUM_COLORS[type],
                    marginBottom: 3,
                    marginLeft: 'auto',
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: DRUM_COLORS[type], textTransform: 'uppercase',
                  }}>
                    {type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* SVG piano roll */}
          <div style={{ flex: 1, position: 'relative', overflowX: 'auto' }}>
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ display: 'block', height: H, cursor: duration > 0 ? 'pointer' : 'default', minWidth: 600 }}
              onClick={handleSvgClick}
            >
              {/* Row backgrounds + grid lines */}
              {DRUM_ORDER.map((type, ri) => {
                const y = ri * ROW_H
                return (
                  <g key={type}>
                    <rect
                      x={0} y={y} width={W} height={ROW_H}
                      fill={ri % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'}
                    />
                    <line x1={0} y1={y + ROW_H} x2={W} y2={y + ROW_H}
                      stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  </g>
                )
              })}

              {/* Bar lines every 10% */}
              {Array.from({ length: 10 }, (_, i) => (
                <line
                  key={i}
                  x1={(i + 1) * W / 10} y1={0}
                  x2={(i + 1) * W / 10} y2={H}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={1}
                />
              ))}

              {/* Hit events */}
              {detectionResult.hits.map(hit => {
                const ri = DRUM_ORDER.indexOf(hit.drum_type)
                if (ri < 0) return null
                const x = (hit.timestamp / Math.max(duration, 0.001)) * W
                const y = ri * ROW_H
                const hitH = ROW_H - 8
                const alpha = 0.45 + hit.confidence * 0.55
                const color = DRUM_COLORS[hit.drum_type]
                return (
                  <g key={hit.id}>
                    <rect
                      x={x - 2} y={y + 4}
                      width={4} height={hitH}
                      fill={color}
                      opacity={alpha}
                      rx={1}
                    />
                    <rect
                      x={x - 1} y={y + 4}
                      width={2} height={hitH}
                      fill="white"
                      opacity={alpha * 0.3}
                      rx={0.5}
                    />
                  </g>
                )
              })}

              {/* Playhead */}
              {duration > 0 && (
                <rect
                  x={progress * W - 1} y={0}
                  width={2} height={H}
                  fill="rgba(255,255,255,0.8)"
                />
              )}
            </svg>

            {/* Time axis */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
              borderTop: '1px solid var(--border)',
            }}>
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i} className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {(duration * i / 10).toFixed(1)}s
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Hit table */}
        <div style={{ margin: '20px 20px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{
            padding: '8px 14px',
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)',
          }}>
            HIT TABLE — {detectionResult.hits.length} EVENTS
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-panel)', position: 'sticky', top: 0 }}>
                  {['#', 'TIME', 'TYPE', 'VELOCITY', 'CONF', 'FREQ'].map(h => (
                    <th key={h} style={{
                      padding: '6px 12px', textAlign: 'left',
                      fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detectionResult.hits.map((hit, i) => (
                  <tr
                    key={hit.id}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => seekRef.current?.(hit.timestamp)}
                  >
                    <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="mono" style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>{hit.timestamp.toFixed(3)}s</td>
                    <td style={{ padding: '5px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                        background: DRUM_COLORS[hit.drum_type] + '22',
                        color: DRUM_COLORS[hit.drum_type],
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {hit.drum_type}
                      </span>
                    </td>
                    <td style={{ padding: '5px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${(hit.velocity / 127) * 100}%`, height: '100%', background: DRUM_COLORS[hit.drum_type] }} />
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
