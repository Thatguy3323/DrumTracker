import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

interface SessionSummary {
  detection_id: string
  audio_id: string
  file_name: string
  total_hits: number
  confidence: number
  completed_at: string
  duration: number
  audio_available: boolean
  created_at: string | null
}

const PRUNE_DAYS = 30
const WARN_DAYS = 7

function getDaysUntilPrune(createdAt: string | null): number | null {
  if (!createdAt) return null
  const created = new Date(createdAt.endsWith('Z') ? createdAt : createdAt + 'Z')
  const expiresAt = new Date(created.getTime() + PRUNE_DAYS * 86400 * 1000)
  const msLeft = expiresAt.getTime() - Date.now()
  return Math.ceil(msLeft / (86400 * 1000))
}

const DRUM_COLORS: Record<string, string> = {
  kick: '#FF2244',
  snare: '#00C8FF',
  hihat: '#00FF7F',
  tom: '#FF7A00',
}

export default function Sessions() {
  const { setAudioMeta, setDetectionResult, setWaveformPeaks } = useApp()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/sessions')
      setSessions(data)
    } catch {
      setError('Could not load session history.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadSession(detectionId: string, fileName: string) {
    setDownloadingId(detectionId)
    try {
      const response = await axios.get(`/api/sessions/${detectionId}/export`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `drumtracker_session_${detectionId.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to download session.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function importSession(file: File) {
    setImporting(true)
    setError('')
    setImportSuccess('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await axios.post('/api/sessions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportSuccess('Session imported successfully.')
      await fetchSessions()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to import session.')
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  async function loadSession(detectionId: string, audioId: string) {
    setLoadingId(detectionId)
    try {
      const { data } = await axios.get(`/api/sessions/${detectionId}/load`)
      setAudioMeta(data.audio)
      setDetectionResult(data.detection)

      try {
        const { data: wf } = await axios.get(`/api/audio/${audioId}/waveform?points=300`)
        setWaveformPeaks(wf.peaks)
      } catch {
        setWaveformPeaks([])
      }

      navigate('/detection')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load session.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Session History</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) importSession(f)
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            style={{ fontSize: 12 }}
            title="Import a previously exported .zip session backup"
          >
            {importing ? <><Spinner /> Importing…</> : '⬆ Import session'}
          </button>
          <button className="btn btn-secondary" onClick={fetchSessions} style={{ fontSize: 12 }}>
            ↺ Refresh
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Previously detected sessions are stored in SQLite and survive server restarts. Click a session to restore it.
      </p>

      {importSuccess && (
        <div style={{ padding: '10px 14px', background: 'rgba(0,200,127,0.1)', border: '1px solid var(--color-secondary)', borderRadius: 6, color: 'var(--color-secondary)', marginBottom: 20, fontSize: 13 }}>
          {importSuccess}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,0,51,0.1)', border: '1px solid var(--color-error)', borderRadius: 6, color: 'var(--color-error)', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
          <Spinner /> <span style={{ marginLeft: 10 }}>Loading sessions…</span>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 240, background: 'var(--bg-card)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', gap: 12, color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>◷</div>
          <div>No sessions yet — upload audio and run detection to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => (
            <SessionCard
              key={s.detection_id}
              session={s}
              loading={loadingId === s.detection_id}
              downloading={downloadingId === s.detection_id}
              onLoad={() => loadSession(s.detection_id, s.audio_id)}
              onDownload={() => downloadSession(s.detection_id, s.file_name)}
              audioAvailable={s.audio_available}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({ session: s, loading, downloading, onLoad, onDownload, audioAvailable }: {
  session: SessionSummary
  loading: boolean
  downloading: boolean
  onLoad: () => void
  onDownload: () => void
  audioAvailable: boolean
}) {
  const date = s.completed_at
    ? new Date(s.completed_at + (s.completed_at.endsWith('Z') ? '' : 'Z')).toLocaleString()
    : '—'

  const daysLeft = getDaysUntilPrune(s.created_at)
  const showExpiry = daysLeft !== null && daysLeft <= WARN_DAYS
  const expiryUrgent = daysLeft !== null && daysLeft <= 2

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.file_name}
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {s.detection_id.slice(0, 8)}
          </span>
          {!audioAvailable && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#FF9500',
              background: 'rgba(255,149,0,0.12)',
              border: '1px solid rgba(255,149,0,0.4)',
              borderRadius: 4,
              padding: '2px 7px',
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}>
              ⚠ Audio unavailable
            </span>
          )}
          {showExpiry && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: expiryUrgent ? '#FF2244' : '#FF9500',
              background: expiryUrgent ? 'rgba(255,34,68,0.1)' : 'rgba(255,149,0,0.1)',
              border: `1px solid ${expiryUrgent ? 'rgba(255,34,68,0.4)' : 'rgba(255,149,0,0.4)'}`,
              borderRadius: 4,
              padding: '2px 7px',
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}
              title="Audio files are pruned 30 days after upload. Export this session to keep it."
            >
              ⏳ {daysLeft <= 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${daysLeft}d`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Stat label="Hits" value={s.total_hits} color="var(--color-primary)" />
          <Stat label="Confidence" value={`${(s.confidence * 100).toFixed(0)}%`} color="var(--color-secondary)" />
          <Stat label="Duration" value={`${s.duration.toFixed(1)}s`} color="var(--color-tertiary)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {date}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          className="btn btn-secondary"
          onClick={onDownload}
          disabled={downloading || loading || !audioAvailable}
          title={!audioAvailable ? 'Audio file was pruned from disk — download is unavailable' : 'Download session zip (audio + hits JSON)'}
          style={{ fontSize: 12, padding: '8px 14px', opacity: audioAvailable ? 1 : 0.45, cursor: audioAvailable ? undefined : 'not-allowed' }}
        >
          {downloading ? <><Spinner /> Zipping…</> : '⬇ Download'}
        </button>
        <button
          className="btn btn-primary"
          onClick={onLoad}
          disabled={loading || downloading}
          style={{ fontSize: 12, padding: '8px 16px' }}
        >
          {loading ? <><Spinner /> Loading…</> : '↩ Restore'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label.toUpperCase()}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)',
      borderTop: '2px solid currentColor', borderRadius: '50%',
      display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }} />
  )
}
