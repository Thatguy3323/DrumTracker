import { useState } from 'react'
import axios from 'axios'
import { useApp, DrumHit } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

const DRUM_COLORS: Record<string, string> = {
  kick: '#FF2244',
  snare: '#00C8FF',
  hihat: '#00FF7F',
  tom: '#FF7A00',
}

export default function HitDetection() {
  const { audioMeta, detectionResult, setDetectionResult } = useApp()
  const navigate = useNavigate()

  const [sensitivity, setSensitivity] = useState(0.7)
  const [threshold, setThreshold] = useState(-18)
  const [preFilter, setPreFilter] = useState(15)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function detect() {
    if (!audioMeta) return
    setLoading(true)
    setError('')
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
    } finally {
      setLoading(false)
    }
  }

  if (!audioMeta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>◈</div>
        <div style={{ color: 'var(--text-muted)' }}>No audio loaded. Upload a file first.</div>
        <button className="btn btn-secondary" onClick={() => navigate('/audio')}>Go to Audio Processing</button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 6, fontSize: 18, fontWeight: 600 }}>Hit Detection</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Tune the DSP parameters and run librosa onset detection on <strong style={{ color: 'var(--text-secondary)' }}>{audioMeta.file_name}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Controls panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SliderControl
            label="Sensitivity"
            value={sensitivity}
            min={0.1} max={1.0} step={0.01}
            display={sensitivity.toFixed(2)}
            hint="Higher = more hits detected"
            onChange={setSensitivity}
            color="var(--color-primary)"
          />
          <SliderControl
            label="Threshold (dB)"
            value={threshold}
            min={-40} max={-3} step={0.5}
            display={`${threshold} dB`}
            hint="Minimum energy to register a hit"
            onChange={setThreshold}
            color="var(--color-secondary)"
          />
          <SliderControl
            label="Pre-filter (ms)"
            value={preFilter}
            min={5} max={30} step={1}
            display={`${preFilter} ms`}
            hint="Minimum gap between hits"
            onChange={setPreFilter}
            color="var(--color-tertiary)"
          />

          <button
            className="btn btn-primary"
            onClick={detect}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {loading ? (
              <><Spinner /> Analyzing…</>
            ) : (
              <>◎ Detect Hits</>
            )}
          </button>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-error)', padding: '8px 12px', background: 'rgba(255,0,51,0.1)', borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {detectionResult ? (
            <>
              <SummaryBar result={detectionResult} />
              <HitGrid hits={detectionResult.hits} duration={audioMeta.duration} />
            </>
          ) : (
            <div style={{
              height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>◎</div>
              <div>Run detection to see results</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SliderControl({ label, value, min, max, step, display, hint, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; hint: string; onChange: (v: number) => void; color: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ margin: 0 }}>{label}</label>
        <span className="mono" style={{ fontSize: 12, color, fontWeight: 600 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color }} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>
    </div>
  )
}

function SummaryBar({ result }: { result: NonNullable<ReturnType<typeof useApp>['detectionResult']> }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {[
        { label: 'Hits', value: result.total_hits, color: 'var(--color-primary)' },
        { label: 'Confidence', value: `${(result.confidence * 100).toFixed(0)}%`, color: 'var(--color-secondary)' },
        { label: 'Time', value: `${result.processing_time.toFixed(2)}s`, color: 'var(--color-tertiary)' },
        ...Object.entries(result.hits_by_type).map(([type, count]) => ({
          label: type, value: count, color: DRUM_COLORS[type] ?? 'var(--text-secondary)'
        })),
      ].map(s => (
        <div key={s.label} style={{ padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{s.label.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

function HitGrid({ hits, duration }: { hits: DrumHit[]; duration: number }) {
  const W = 100, H = 80

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        HIT MAP — {hits.length} events
      </div>

      {/* Timeline */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 80 }}>
          {['kick', 'snare', 'hihat', 'tom'].map((type, ti) => {
            const y = ti * (H / 4) + 2
            const h = H / 4 - 4
            return (
              <g key={type}>
                <rect x={0} y={y} width={W} height={h} fill="rgba(255,255,255,0.02)" rx={1} />
                {hits.filter(hit => hit.drum_type === type).map(hit => {
                  const x = (hit.timestamp / duration) * W
                  const alpha = 0.5 + hit.confidence * 0.5
                  return (
                    <rect
                      key={hit.id}
                      x={x}
                      y={y + 1}
                      width={Math.min(1.5, W * 0.015)}
                      height={h - 2}
                      fill={DRUM_COLORS[type]}
                      opacity={alpha}
                      rx={0.5}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>0s</span><span>{(duration / 2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, padding: '10px 16px' }}>
        {['kick', 'snare', 'hihat', 'tom'].map(type => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: DRUM_COLORS[type], display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Hit table */}
      <div style={{ maxHeight: 260, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-panel)' }}>
              {['Time', 'Type', 'Velocity', 'Confidence', 'Centroid'].map(h => (
                <th key={h} style={{ padding: '6px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 500 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hits.map((hit, i) => (
              <tr key={hit.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td className="mono" style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{hit.timestamp.toFixed(3)}s</td>
                <td style={{ padding: '6px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: DRUM_COLORS[hit.drum_type] + '22', color: DRUM_COLORS[hit.drum_type] }}>
                    {hit.drum_type}
                  </span>
                </td>
                <td className="mono" style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(hit.velocity / 127) * 100}%`, height: '100%', background: DRUM_COLORS[hit.drum_type] }} />
                    </div>
                    {hit.velocity}
                  </div>
                </td>
                <td className="mono" style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {(hit.confidence * 100).toFixed(0)}%
                </td>
                <td className="mono" style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {hit.frequency_centroid ? `${hit.frequency_centroid.toFixed(0)} Hz` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)',
      borderTop: '2px solid currentColor', borderRadius: '50%',
      display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }} />
  )
}
