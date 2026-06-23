import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'

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
const WARN_DAYS  = 7

function getDaysUntilPrune(createdAt: string | null): number | null {
  if (!createdAt) return null
  const created    = new Date(createdAt.endsWith('Z') ? createdAt : createdAt + 'Z')
  const expiresAt  = new Date(created.getTime() + PRUNE_DAYS * 86400 * 1000)
  return Math.ceil((expiresAt.getTime() - Date.now()) / (86400 * 1000))
}

interface Props {
  onClose: () => void
  onRestored: () => void
}

export default function SessionsModal({ onClose, onRestored }: Props) {
  const { setAudioMeta, setDetectionResult, setWaveformPeaks } = useApp()
  const [sessions, setSessions]     = useState<SessionSummary[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [dlId, setDlId]             = useState<string | null>(null)
  const [importing, setImporting]   = useState(false)
  const [importMsg, setImportMsg]   = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    setLoading(true); setError('')
    try {
      const { data } = await axios.get('/api/sessions')
      setSessions(data)
    } catch { setError('Could not load sessions.') }
    finally { setLoading(false) }
  }

  async function loadSession(det: string, audio: string) {
    setLoadingId(det)
    try {
      const { data } = await axios.get(`/api/sessions/${det}/load`)
      setAudioMeta(data.audio)
      setDetectionResult(data.detection)
      try {
        const { data: wf } = await axios.get(`/api/audio/${audio}/waveform?points=300`)
        setWaveformPeaks(wf.peaks)
      } catch { setWaveformPeaks([]) }
      onRestored()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load session.')
    } finally { setLoadingId(null) }
  }

  async function downloadSession(det: string, name: string) {
    setDlId(det)
    try {
      const res = await axios.get(`/api/sessions/${det}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url
      a.download = `drumtracker_session_${det.slice(0, 8)}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Download failed.')
    } finally { setDlId(null) }
  }

  async function importSession(file: File) {
    setImporting(true); setError(''); setImportMsg('')
    try {
      const fd = new FormData(); fd.append('file', file)
      await axios.post('/api/sessions/import', fd)
      setImportMsg('Session imported.')
      await fetchSessions()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Import failed.')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: 700, maxHeight: '80vh',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span className="panel-label">SESSION HISTORY</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input ref={importRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importSession(f) }} />
            <button
              className="btn btn-secondary"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              style={{ fontSize: 11 }}
            >
              {importing ? 'Importing…' : '⬆ Import'}
            </button>
            <button className="btn btn-secondary" onClick={fetchSessions} style={{ fontSize: 11 }}>↺ Refresh</button>
            <button
              onClick={onClose}
              style={{ padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {importMsg && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(0,229,204,0.1)', border: '1px solid rgba(0,229,204,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--color-secondary)' }}>
              {importMsg}
            </div>
          )}
          {error && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,34,68,0.1)', border: '1px solid rgba(255,34,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--color-error)' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', gap: 10 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'currentColor',
                borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              }} />
              Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: 140, gap: 10, color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: 36, opacity: 0.15 }}>◷</div>
              <div style={{ fontSize: 12 }}>No sessions yet — upload audio and run detection.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => {
                const daysLeft  = getDaysUntilPrune(s.created_at)
                const showExpiry = daysLeft !== null && daysLeft <= WARN_DAYS
                const urgent     = daysLeft !== null && daysLeft <= 2
                const date       = s.completed_at
                  ? new Date(s.completed_at + (s.completed_at.endsWith('Z') ? '' : 'Z')).toLocaleString()
                  : '—'

                return (
                  <div key={s.detection_id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '12px 16px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.file_name}
                        </span>
                        <span className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {s.detection_id.slice(0, 8)}
                        </span>
                        {!s.audio_available && (
                          <span style={{ fontSize: 9, color: '#FF9500', background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>
                            ⚠ Audio pruned
                          </span>
                        )}
                        {showExpiry && (
                          <span style={{
                            fontSize: 9, flexShrink: 0,
                            color: urgent ? 'var(--color-error)' : '#FF9500',
                            background: urgent ? 'rgba(255,34,68,0.1)' : 'rgba(255,149,0,0.1)',
                            border: `1px solid ${urgent ? 'rgba(255,34,68,0.3)' : 'rgba(255,149,0,0.3)'}`,
                            borderRadius: 3, padding: '1px 6px',
                          }}>
                            ⏳ {daysLeft! <= 0 ? 'Expires today' : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Hits',       value: s.total_hits,                       color: 'var(--color-primary)' },
                          { label: 'Confidence', value: `${(s.confidence * 100).toFixed(0)}%`, color: 'var(--color-secondary)' },
                          { label: 'Duration',   value: `${s.duration.toFixed(1)}s`,        color: 'var(--color-tertiary)' },
                        ].map(st => (
                          <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{st.label.toUpperCase()}</span>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{st.value}</span>
                          </div>
                        ))}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>{date}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => downloadSession(s.detection_id, s.file_name)}
                        disabled={dlId === s.detection_id || loadingId === s.detection_id || !s.audio_available}
                        title={!s.audio_available ? 'Audio was pruned — download unavailable' : undefined}
                        style={{ fontSize: 11, opacity: s.audio_available ? 1 : 0.4 }}
                      >
                        {dlId === s.detection_id ? 'Zipping…' : '⬇ Export'}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => loadSession(s.detection_id, s.audio_id)}
                        disabled={loadingId === s.detection_id || dlId === s.detection_id}
                        style={{ fontSize: 11 }}
                      >
                        {loadingId === s.detection_id ? 'Loading…' : '↩ Restore'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
