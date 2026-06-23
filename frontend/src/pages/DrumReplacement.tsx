import { useState } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

const KITS = [
  { id: 'rock',       name: 'Rock Standard',     style: 'Rock',       color: '#FF2244', icon: '🥁' },
  { id: 'jazz',       name: 'Jazz Brushes',       style: 'Jazz',       color: '#FF7A00', icon: '🎷' },
  { id: 'electronic', name: 'Electronic 808',     style: 'Electronic', color: '#00C8FF', icon: '⚡' },
  { id: 'hiphop',     name: 'Hip-Hop SP',         style: 'Hip-Hop',    color: '#00FF7F', icon: '🎤' },
  { id: 'metal',      name: 'Metal Blast',        style: 'Metal',      color: '#AA44FF', icon: '🤘' },
  { id: 'latin',      name: 'Latin Percussion',   style: 'Latin',      color: '#FFD700', icon: '🎵' },
]

export default function DrumReplacement() {
  const { detectionResult, audioMeta, selectedKit, setSelectedKit } = useApp()
  const navigate = useNavigate()

  const [keepOriginal, setKeepOriginal] = useState(true)
  const [kitLevel, setKitLevel]       = useState(0.7)
  const [processing, setProcessing]   = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState('')

  if (!detectionResult) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🥁</div>
        <div style={{ color: 'var(--text-muted)' }}>No detection results yet.</div>
        <button className="btn btn-secondary" onClick={() => navigate('/detection')}>
          Go to Hit Detection
        </button>
      </div>
    )
  }

  const kit = KITS.find(k => k.id === selectedKit) ?? null

  async function processReplacement() {
    if (!detectionResult) return
    setProcessing(true)
    setDone(false)
    setError('')
    try {
      const res = await axios.post(
        '/api/replacement/process',
        {
          detection_id: detectionResult.detection_id,
          kit_id: selectedKit ?? 'rock',
          keep_original: keepOriginal,
          kit_level: kitLevel,
        },
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(new Blob([res.data], { type: 'audio/wav' }))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `drumtracker_${keepOriginal ? 'augmented' : 'replaced'}_${detectionResult.detection_id.slice(0, 8)}.wav`
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch {
      setError('Processing failed. Make sure you have uploaded audio and run detection first.')
    } finally {
      setProcessing(false)
    }
  }

  const { hits_by_type, total_hits } = detectionResult

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ marginBottom: 6, fontSize: 18, fontWeight: 600 }}>Drum Replacement</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Layer a drum kit over your original audio or build a clean replacement track.
        Original drums are kept by default.
      </p>

      {/* Original drums toggle */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>
          ORIGINAL DRUMS
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              Keep original drums in mix
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {keepOriginal
                ? 'Your original drum performance is preserved. Kit samples are layered on top.'
                : 'Original audio is muted for drums. Only the selected kit samples will be heard.'}
            </div>
          </div>
          <Toggle value={keepOriginal} onChange={setKeepOriginal} />
        </div>

        {keepOriginal && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(0,255,127,0.06)', border: '1px solid rgba(0,255,127,0.2)',
            borderRadius: 8, fontSize: 12, color: 'var(--color-primary)',
          }}>
            ✓ Original performance preserved — {total_hits} detected hits will be augmented with kit samples
          </div>
        )}

        {/* Hit type summary */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {Object.entries(hits_by_type).map(([type, count]) => (
            <div key={type} style={{
              padding: '5px 12px', borderRadius: 6,
              background: `${drumColor(type)}18`, border: `1px solid ${drumColor(type)}44`,
            }}>
              <span style={{ fontSize: 11, color: drumColor(type), fontWeight: 600, textTransform: 'capitalize' }}>
                {type}: {count as number}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Kit selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>
          KIT SELECTION <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {KITS.map(k => (
            <button
              key={k.id}
              onClick={() => setSelectedKit(selectedKit === k.id ? null : k.id)}
              style={{
                background: selectedKit === k.id ? `${k.color}14` : 'var(--bg-panel)',
                border: `1px solid ${selectedKit === k.id ? k.color + '55' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>{k.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedKit === k.id ? k.color : 'var(--text-primary)' }}>
                  {k.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{k.style}</div>
              </div>
              {selectedKit === k.id && (
                <span style={{
                  marginLeft: 'auto',
                  width: 18, height: 18, borderRadius: '50%',
                  background: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#000', flexShrink: 0,
                }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {!selectedKit && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No kit selected — processing will use synthesized Rock Standard sounds by default.
          </div>
        )}
      </div>

      {/* Mix level */}
      {selectedKit && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>
            KIT MIX LEVEL
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ margin: 0, fontSize: 13 }}>
              {kit ? kit.name : 'Kit'} volume in mix
            </label>
            <span className="mono" style={{ fontSize: 13, color: kit?.color ?? 'var(--color-primary)', fontWeight: 600 }}>
              {Math.round(kitLevel * 100)}%
            </span>
          </div>
          <input
            type="range" min={10} max={100} step={5}
            value={Math.round(kitLevel * 100)}
            onChange={e => setKitLevel(+e.target.value / 100)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            {keepOriginal
              ? 'How loud the kit samples are relative to the original audio'
              : 'Volume of synthesized kit samples in the output file'}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="card">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>
          EXPORT
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <InfoRow label="Output Format"  value="WAV 16-bit PCM" />
          <InfoRow label="Sample Rate"    value={`${audioMeta?.sample_rate ?? 44100} Hz`} />
          <InfoRow label="Mode"           value={keepOriginal ? 'Augment (original + kit)' : 'Replace (kit only)'} />
          <InfoRow label="Kit"            value={kit?.name ?? 'Rock Standard (default)'} />
        </div>

        <button
          className="btn btn-primary"
          onClick={processReplacement}
          disabled={processing}
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 14 }}
        >
          {processing
            ? '⏳ Processing audio…'
            : done
              ? '✓ Download Again'
              : keepOriginal
                ? '↓ Download Augmented Mix'
                : '↓ Download Replaced Audio'}
        </button>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-error)', padding: '8px 12px', background: 'rgba(255,0,51,0.1)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {done && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-primary)', padding: '8px 12px', background: 'rgba(0,255,127,0.08)', borderRadius: 6 }}>
            ✓ WAV file downloaded. Import it into your DAW alongside the original project.
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        flexShrink: 0,
        width: 48, height: 26,
        borderRadius: 13,
        background: value ? 'var(--color-primary)' : 'var(--bg-panel)',
        border: `1px solid ${value ? 'var(--color-primary)' : 'var(--border)'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
        outline: 'none',
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3, left: value ? 25 : 3,
        width: 18, height: 18,
        borderRadius: '50%',
        background: value ? '#000' : 'var(--text-muted)',
        transition: 'left 0.2s ease',
      }} />
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function drumColor(type: string): string {
  const map: Record<string, string> = {
    kick: '#FF2244', snare: '#00C8FF', hihat: '#00FF7F', tom: '#FF7A00',
  }
  return map[type] ?? '#A4A9B8'
}
