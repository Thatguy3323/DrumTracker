import { useState } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

export default function MidiExport() {
  const { detectionResult, audioMeta } = useApp()
  const navigate = useNavigate()
  const [tempo, setTempo] = useState(120)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [error, setError] = useState('')

  async function exportMidi() {
    if (!detectionResult) return
    setExporting(true)
    setError('')
    try {
      const response = await axios.get(
        `/api/export/midi/${detectionResult.detection_id}?tempo=${tempo}`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([response.data], { type: 'audio/midi' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `drumtracker_${detectionResult.detection_id.slice(0, 8)}.mid`
      a.click()
      URL.revokeObjectURL(url)
      setExported(true)
    } catch (e: any) {
      setError('Export failed. Please run detection first.')
    } finally {
      setExporting(false)
    }
  }

  if (!detectionResult) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>↗</div>
        <div style={{ color: 'var(--text-muted)' }}>No detection results yet.</div>
        <button className="btn btn-secondary" onClick={() => navigate('/detection')}>Go to Hit Detection</button>
      </div>
    )
  }

  const { hits_by_type, total_hits, confidence, processing_time, detection_id } = detectionResult

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 6, fontSize: 18, fontWeight: 600 }}>MIDI Export</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Export detected hits as a professional MIDI file compatible with any DAW.
      </p>

      {/* Detection summary card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>DETECTION SUMMARY</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat label="Total Hits" value={total_hits} color="var(--color-primary)" />
          <Stat label="Confidence" value={`${(confidence * 100).toFixed(0)}%`} color="var(--color-secondary)" />
          <Stat label="Process Time" value={`${processing_time.toFixed(2)}s`} color="var(--color-tertiary)" />
          <Stat label="Source" value={audioMeta?.file_name ?? '—'} color="var(--text-secondary)" />
        </div>

        {/* Per-type breakdown */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(hits_by_type).map(([type, count]) => (
            <div key={type} style={{
              padding: '6px 14px', borderRadius: 6,
              background: `${drumColor(type)}18`, border: `1px solid ${drumColor(type)}44`,
            }}>
              <span style={{ fontSize: 11, color: drumColor(type), fontWeight: 600, textTransform: 'capitalize' }}>
                {type}: {count}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          ID: {detection_id}
        </div>
      </div>

      {/* Export settings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 18 }}>EXPORT SETTINGS</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ margin: 0 }}>Tempo</label>
            <span className="mono" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{tempo} BPM</span>
          </div>
          <input type="range" min={40} max={240} step={1} value={tempo} onChange={e => setTempo(+e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>MIDI playback tempo (does not affect hit positions)</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Format', value: 'MIDI Type 1 (.mid)' },
            { label: 'Drum Channel', value: 'CH 10 (GM Standard)' },
            { label: 'Note Mapping', value: 'GM Drum Kit' },
            { label: 'Time Signature', value: '4/4' },
          ].map(r => (
            <div key={r.label} style={{ padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>{r.label.toUpperCase()}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{r.value}</div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary"
          onClick={exportMidi}
          disabled={exporting}
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 14 }}
        >
          {exporting ? '⏳ Generating MIDI…' : exported ? '✓ Download Again' : '↗ Download MIDI File'}
        </button>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-error)', padding: '8px 12px', background: 'rgba(255,0,51,0.1)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {exported && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-primary)', padding: '8px 12px', background: 'rgba(0,255,127,0.08)', borderRadius: 6 }}>
            ✓ MIDI file downloaded successfully. Import it into your DAW.
          </div>
        )}
      </div>

      {/* GM note mapping reference */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>GM Note Mapping:</strong>{' '}
        Kick → C2 (36) · Snare → D2 (38) · Hi-Hat → F#2 (42) · Tom → A2 (45)
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function drumColor(type: string): string {
  const map: Record<string, string> = {
    kick: '#FF2244', snare: '#00C8FF', hihat: '#00FF7F', tom: '#FF7A00',
  }
  return map[type] ?? '#A4A9B8'
}
