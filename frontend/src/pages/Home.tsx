import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Home() {
  const navigate = useNavigate()
  const { audioMeta, detectionResult } = useApp()

  const steps = [
    { num: '01', title: 'Upload Audio', desc: 'Load your WAV or MP3 drum recording', path: '/audio', icon: '◈', done: !!audioMeta },
    { num: '02', title: 'Detect Hits', desc: 'Real-time transient analysis with librosa DSP', path: '/detection', icon: '◎', done: !!detectionResult },
    { num: '03', title: 'Select Kit', desc: 'Choose a drum kit for replacement', path: '/kits', icon: '◉', done: false },
    { num: '04', title: 'Export MIDI', desc: 'Download your professional MIDI file', path: '/export', icon: '↗', done: !!detectionResult },
  ]

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <div className="orbitron" style={{
          fontSize: 32,
          fontWeight: 900,
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 10,
        }}>
          DrumTracker
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 520 }}>
          Professional drum hit detection powered by real audio DSP. Upload any recording,
          detect transients with librosa, classify hits spectrally, and export to MIDI.
        </p>
      </div>

      {/* Quick-start steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
        {steps.map(s => (
          <button
            key={s.num}
            onClick={() => navigate(s.path)}
            style={{
              background: s.done ? 'rgba(0,255,127,0.06)' : 'var(--bg-card)',
              border: `1px solid ${s.done ? 'rgba(0,255,127,0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '20px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = s.done ? 'rgba(0,255,127,0.3)' : 'var(--border)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                STEP {s.num}
              </span>
              {s.done && <span style={{ fontSize: 10, color: 'var(--color-primary)', background: 'rgba(0,255,127,0.1)', padding: '2px 8px', borderRadius: 10 }}>DONE</span>}
            </div>
            <div style={{ fontSize: 22, marginBottom: 8, color: s.done ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
              {s.icon}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{s.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Stats row */}
      {detectionResult && (
        <div className="card" style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <Stat label="Total Hits" value={detectionResult.total_hits} unit="" color="var(--color-primary)" />
          <Stat label="Confidence" value={Math.round(detectionResult.confidence * 100)} unit="%" color="var(--color-secondary)" />
          <Stat label="Process Time" value={detectionResult.processing_time.toFixed(2)} unit="s" color="var(--color-tertiary)" />
          {Object.entries(detectionResult.hits_by_type).map(([type, count]) => (
            <Stat key={type} label={type.toUpperCase()} value={count} unit="" color={`var(--${type}-color, var(--text-secondary))`} />
          ))}
        </div>
      )}

      {/* Tech note */}
      <div style={{ marginTop: 32, padding: '14px 18px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>DSP Engine: </span>
        librosa onset detection (onset_detect) → spectral classification (FFT frequency bands) → MIDI velocity from RMS energy · midiutil MIDI export
      </div>
    </div>
  )
}

function Stat({ label, value, unit, color }: { label: string; value: number | string; unit: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'Orbitron, sans-serif' }}>
        {value}<span style={{ fontSize: 14, marginLeft: 2, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  )
}
