import { useState, useRef, useEffect, DragEvent } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import type { ConversionJob } from '../context/AppContext'

export default function AudioProcessing() {
  const { audioMeta, setAudioMeta, setWaveformPeaks, setAudioObjectUrl } = useApp()
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

      // Store a browser-side ObjectURL so the player can stream directly
      setAudioObjectUrl(URL.createObjectURL(file))

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
      {audioMeta && <ConversionPanel audioId={audioMeta.audio_id} />}
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

// ── Conversion Panel ──────────────────────────────────────────────────────────

const FORMATS = [
  { value: 'mp3',  label: 'MP3',  icon: '🎵' },
  { value: 'wav',  label: 'WAV',  icon: '🔊' },
  { value: 'flac', label: 'FLAC', icon: '💎' },
  { value: 'ogg',  label: 'OGG',  icon: '🌀' },
  { value: 'aac',  label: 'AAC',  icon: '📱' },
  { value: 'm4a',  label: 'M4A',  icon: '🍎' },
]

const BITRATES = ['128k', '192k', '256k', '320k']

function ConversionPanel({ audioId }: { audioId: string }) {
  const { conversionJobs, addConversionJob, updateConversionJob } = useApp()
  const [format, setFormat]   = useState('mp3')
  const [bitrate, setBitrate] = useState('192k')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval)
    }
  }, [])

  function startPolling(jobId: string) {
    if (pollRefs.current[jobId]) return
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`/api/convert/${jobId}/status`)
        const d = res.data
        updateConversionJob(jobId, {
          status:   d.status,
          filename: d.filename || undefined,
          error:    d.error ?? undefined,
        })
        if (d.status === 'done' || d.status === 'failed') {
          clearInterval(pollRefs.current[jobId])
          delete pollRefs.current[jobId]
        }
      } catch {
        clearInterval(pollRefs.current[jobId])
        delete pollRefs.current[jobId]
      }
    }, 1200)
    pollRefs.current[jobId] = iv
  }

  async function handleConvert() {
    setBusy(true)
    setErr('')
    try {
      const res = await axios.post('/api/convert/start', {
        audio_id: audioId,
        target_format: format,
        bitrate,
      })
      const job: ConversionJob = {
        job_id: res.data.job_id,
        status: 'running',
        format: res.data.format,
        filename: '',
      }
      addConversionJob(job)
      startPolling(res.data.job_id)
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Conversion failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(job: ConversionJob) {
    try {
      const res = await axios.get(`/api/convert/${job.job_id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = job.filename || `converted.${job.format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setErr('Download failed.')
    }
  }

  const lossyFormats = ['mp3', 'aac', 'm4a', 'ogg']
  const showBitrate = lossyFormats.includes(format)

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-tertiary)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Format Conversion</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>FFmpeg</span>
      </div>

      {/* Format grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
        {FORMATS.map(f => (
          <button
            key={f.value}
            onClick={() => setFormat(f.value)}
            style={{
              padding: '10px 4px',
              borderRadius: 8,
              border: `1px solid ${format === f.value ? 'var(--color-tertiary)' : 'var(--border)'}`,
              background: format === f.value ? 'rgba(255,122,0,0.12)' : 'var(--bg-panel)',
              color: format === f.value ? 'var(--color-tertiary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}>{f.label}</div>
          </button>
        ))}
      </div>

      {/* Bitrate (lossy only) */}
      {showBitrate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 56 }}>BITRATE</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {BITRATES.map(b => (
              <button
                key={b}
                onClick={() => setBitrate(b)}
                style={{
                  padding: '4px 12px', borderRadius: 4,
                  border: `1px solid ${bitrate === b ? 'var(--color-tertiary)' : 'var(--border)'}`,
                  background: bitrate === b ? 'rgba(255,122,0,0.10)' : 'var(--bg-panel)',
                  color: bitrate === b ? 'var(--color-tertiary)' : 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Convert button */}
      <button
        onClick={handleConvert}
        disabled={busy}
        style={{
          width: '100%', padding: '12px', borderRadius: 8,
          background: busy ? 'rgba(255,122,0,0.06)' : 'rgba(255,122,0,0.15)',
          border: '1px solid rgba(255,122,0,0.4)',
          color: 'var(--color-tertiary)', fontWeight: 600, fontSize: 14,
          cursor: busy ? 'not-allowed' : 'pointer', letterSpacing: '0.03em',
          transition: 'all 0.15s',
        }}
      >
        {busy ? 'Starting…' : `Convert to ${format.toUpperCase()}`}
      </button>

      {err && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,0,51,0.08)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 12 }}>
          {err}
        </div>
      )}

      {/* Jobs list */}
      {conversionJobs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>RECENT CONVERSIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conversionJobs.map(job => (
              <div
                key={job.job_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-panel)',
                  border: `1px solid ${job.status === 'done' ? 'rgba(0,255,127,0.25)' : job.status === 'failed' ? 'rgba(255,0,51,0.25)' : 'rgba(255,122,0,0.25)'}`,
                }}
              >
                {/* Status dot / spinner */}
                {job.status === 'running' && (
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, flexShrink: 0,
                    border: '2px solid rgba(255,122,0,0.3)', borderTopColor: 'var(--color-tertiary)',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                )}
                {job.status === 'done' && <span style={{ color: 'var(--color-primary)', fontSize: 14 }}>✓</span>}
                {job.status === 'failed' && <span style={{ color: 'var(--color-error)', fontSize: 14 }}>✗</span>}

                <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                  {job.filename || `${job.format.toUpperCase()} conversion`}
                </span>

                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                  padding: '2px 7px', borderRadius: 4,
                  background: job.status === 'done' ? 'rgba(0,255,127,0.1)' : job.status === 'failed' ? 'rgba(255,0,51,0.1)' : 'rgba(255,122,0,0.1)',
                  color: job.status === 'done' ? 'var(--color-primary)' : job.status === 'failed' ? 'var(--color-error)' : 'var(--color-tertiary)',
                }}>
                  {job.status.toUpperCase()}
                </span>

                {job.status === 'done' && (
                  <button
                    onClick={() => handleDownload(job)}
                    style={{
                      padding: '4px 12px', borderRadius: 4,
                      background: 'rgba(0,255,127,0.1)',
                      border: '1px solid rgba(0,255,127,0.3)',
                      color: 'var(--color-primary)', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ↓ Download
                  </button>
                )}

                {job.error && (
                  <span style={{ fontSize: 11, color: 'var(--color-error)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
