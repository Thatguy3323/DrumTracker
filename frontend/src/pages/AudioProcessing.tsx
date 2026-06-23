import { useState, useRef, DragEvent } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'

export default function AudioProcessing() {
  const { audioMeta, setAudioMeta, setWaveformPeaks } = useApp()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data: meta } = await axios.post('/api/audio/upload', form)
      setAudioMeta(meta)

      // Fetch waveform peaks
      const { data: wf } = await axios.get(`/api/audio/${meta.audio_id}/waveform?points=300`)
      setWaveformPeaks(wf.peaks)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 6, fontSize: 18, fontWeight: 600 }}>Audio Processing</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Upload a WAV or MP3 file. The audio engine extracts PCM data using librosa for analysis.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(0,255,127,0.04)' : 'var(--bg-card)',
          transition: 'all 0.2s ease',
          marginBottom: 24,
        }}
      >
        <input ref={fileRef} type="file" accept=".wav,.mp3,.flac,.ogg,.aiff" hidden
          onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>◈</div>
        {loading ? (
          <div style={{ color: 'var(--color-primary)' }}>Analyzing audio…</div>
        ) : (
          <>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>
              Drop audio file here or click to browse
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>WAV · MP3 · FLAC · OGG · AIFF</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,0,51,0.1)', border: '1px solid var(--color-error)', borderRadius: 6, color: 'var(--color-error)', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {audioMeta && <AudioMetaCard meta={audioMeta} />}
    </div>
  )
}

function AudioMetaCard({ meta }: { meta: ReturnType<typeof useApp>['audioMeta'] }) {
  if (!meta) return null
  const { audioMeta: _, waveformPeaks } = useApp()

  const fields = [
    { label: 'File Name', value: meta.file_name },
    { label: 'Format', value: meta.format },
    { label: 'Sample Rate', value: `${meta.sample_rate.toLocaleString()} Hz` },
    { label: 'Channels', value: meta.channels === 1 ? 'Mono' : 'Stereo' },
    { label: 'Duration', value: `${meta.duration.toFixed(2)}s` },
    { label: 'Total Frames', value: meta.total_frames.toLocaleString() },
  ]

  return (
    <div className="card glow-cyan">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-secondary)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Audio Loaded</span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{meta.audio_id.slice(0, 8)}</span>
      </div>

      {/* Waveform preview */}
      <WaveformDisplay />

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
        {fields.map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>{f.label.toUpperCase()}</div>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WaveformDisplay() {
  const { waveformPeaks } = useApp()
  if (!waveformPeaks.length) return null

  const W = 720, H = 80
  const mid = H / 2
  const barW = W / waveformPeaks.length

  return (
    <div style={{ background: 'var(--bg-panel)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 80 }}>
        {waveformPeaks.map((p, i) => {
          const h = Math.max(1, p * mid * 0.95)
          return (
            <rect
              key={i}
              x={i * barW}
              y={mid - h}
              width={Math.max(1, barW - 0.5)}
              height={h * 2}
              fill="rgba(0,200,255,0.6)"
              rx={0.5}
            />
          )
        })}
        {/* Center line */}
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      </svg>
    </div>
  )
}
