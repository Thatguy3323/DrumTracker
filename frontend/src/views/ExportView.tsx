import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import type { ConversionJob } from '../context/AppContext'
import type { TabId } from '../App'

const DRUM_COLORS: Record<string, string> = {
  kick: '#FF2244', snare: '#00C8FF', hihat: '#00FF41', tom: '#FF7A00',
  crash: '#AA44FF', ride: '#FFD700',
}

const DRUM_NOTES: Record<string, string> = {
  kick: 'C2 (36)', snare: 'D2 (38)', hihat: 'F#2 (42)',
  tom: 'A2 (45)', crash: 'C#3 (49)', ride: 'D#3 (51)',
}

const FORMATS = [
  { value: 'mp3',  label: 'MP3'  },
  { value: 'wav',  label: 'WAV'  },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg',  label: 'OGG'  },
  { value: 'aac',  label: 'AAC'  },
  { value: 'm4a',  label: 'M4A'  },
]

const BITRATES = ['128k', '192k', '256k', '320k']

export default function ExportView({ onNavigateToTab }: { onNavigateToTab?: (tab: TabId) => void }) {
  const { audioMeta, detectionResult, conversionJobs, addConversionJob, updateConversionJob } = useApp()
  const [tempo, setTempo] = useState(120)
  const [midiExporting, setMidiExporting] = useState(false)
  const [midiExported, setMidiExported] = useState(false)
  const [midiError, setMidiError] = useState('')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [bitrate, setBitrate] = useState('192k')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    return () => { Object.values(pollRefs.current).forEach(clearInterval) }
  }, [])

  async function exportMidi() {
    if (!detectionResult) return
    setMidiExporting(true)
    setMidiError('')
    try {
      const res = await axios.get(
        `/api/export/midi/${detectionResult.detection_id}?tempo=${tempo}`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(new Blob([res.data], { type: 'audio/midi' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `drumtracker_${detectionResult.detection_id.slice(0, 8)}.mid`
      a.click()
      URL.revokeObjectURL(url)
      setMidiExported(true)
    } catch {
      setMidiError('Export failed. Run detection first.')
    } finally {
      setMidiExporting(false)
    }
  }

  function startPolling(jobId: string) {
    if (pollRefs.current[jobId]) return
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`/api/convert/${jobId}/status`)
        const d = res.data
        updateConversionJob(jobId, { status: d.status, filename: d.filename || undefined, error: d.error ?? undefined })
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

  async function convertAudio() {
    if (!audioMeta) return
    setConverting(true)
    setConvertError('')
    try {
      const res = await axios.post('/api/convert/start', {
        audio_id: audioMeta.audio_id,
        target_format: audioFormat,
        bitrate,
      })
      const job: ConversionJob = { job_id: res.data.job_id, status: 'running', format: res.data.format, filename: '' }
      addConversionJob(job)
      startPolling(res.data.job_id)
    } catch (e: any) {
      setConvertError(e?.response?.data?.detail ?? 'Conversion failed.')
    } finally {
      setConverting(false)
    }
  }

  async function downloadJob(job: ConversionJob) {
    try {
      const res = await axios.get(`/api/convert/${job.job_id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = job.filename || `converted.${job.format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setConvertError('Download failed.')
    }
  }

  const lossyFormats = ['mp3', 'aac', 'm4a', 'ogg']

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: MIDI export */}
      <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
        {/* Section header */}
        <div className="section-head">
          <span className="panel-label">MIDI EXPORT</span>
          {detectionResult && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-primary)' }}>
              {detectionResult.total_hits} hits ready
            </span>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          {!detectionResult ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 0',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: 48, opacity: 0.15 }}>↗</div>
              <div style={{ fontSize: 13 }}>Run detection first to enable MIDI export</div>
            </div>
          ) : (
            <>
              {/* Detection summary */}
              <div style={{
                padding: '14px', marginBottom: 20,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}>
                <div className="panel-label" style={{ marginBottom: 10 }}>DETECTION SUMMARY</div>
                <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total Hits', value: detectionResult.total_hits, color: 'var(--color-primary)' },
                    { label: 'Confidence', value: `${(detectionResult.confidence * 100).toFixed(0)}%`, color: 'var(--color-secondary)' },
                    { label: 'Process Time', value: `${detectionResult.processing_time.toFixed(2)}s`, color: 'var(--color-tertiary)' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>{s.label.toUpperCase()}</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(detectionResult.hits_by_type).map(([type, count]) => (
                    <div key={type} style={{
                      padding: '4px 10px', borderRadius: 4,
                      background: (DRUM_COLORS[type] ?? '#aaa') + '18',
                      border: `1px solid ${(DRUM_COLORS[type] ?? '#aaa')}44`,
                      fontSize: 11, color: DRUM_COLORS[type] ?? 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {type}: {count}
                    </div>
                  ))}
                </div>
              </div>

              {/* Track list */}
              {Object.keys(detectionResult.hits_by_type).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="panel-label" style={{ marginBottom: 10 }}>ISOLATED TRACKS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {Object.entries(detectionResult.hits_by_type).map(([type, count], i) => {
                      const color = DRUM_COLORS[type] ?? '#aaa'
                      return (
                        <div key={type} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '8px 12px', borderRadius: 'var(--radius)',
                          background: color + '0d',
                          border: `1px solid ${color}33`,
                        }}>
                          <span className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', width: 44 }}>Track {i + 1}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'capitalize', minWidth: 48 }}>{type}</span>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>note {DRUM_NOTES[type] ?? '—'}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{count} hits</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tempo */}
              <div style={{ marginBottom: 20 }}>
                <div className="panel-label" style={{ marginBottom: 8 }}>EXPORT SETTINGS</div>
                <div style={{
                  padding: '14px', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tempo</span>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 700 }}>{tempo} BPM</span>
                  </div>
                  <input
                    type="range" min={40} max={240} step={1} value={tempo}
                    onChange={e => setTempo(+e.target.value)}
                  />
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Format', 'MIDI Type 1 (.mid)'],
                      ['Channel', 'CH 10 (GM Standard)'],
                      ['Tracks', 'One per drum type'],
                      ['Time Sig', '4/4'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: '8px 10px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>{label.toUpperCase()}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-primary)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Export button */}
              <button
                onClick={exportMidi}
                disabled={midiExporting}
                style={{
                  width: '100%', padding: '13px',
                  background: midiExporting ? 'rgba(0,255,65,0.06)' : 'rgba(0,255,65,0.15)',
                  border: '1px solid rgba(0,255,65,0.5)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--color-primary)', fontWeight: 700, fontSize: 13,
                  cursor: midiExporting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em',
                  boxShadow: midiExporting ? 'none' : '0 0 16px rgba(0,255,65,0.12)',
                }}
              >
                {midiExporting ? '⏳ GENERATING MIDI…' : midiExported ? '✓ DOWNLOAD AGAIN' : '↗ DOWNLOAD MIDI FILE'}
              </button>

              {midiError && <ErrorBox msg={midiError} />}
              {midiExported && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.3)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--color-primary)' }}>
                  ✓ MIDI exported. Import it into your DAW.
                </div>
              )}

              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('map')}
                  style={{
                    marginTop: 10,
                    width: '100%', padding: '9px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 11,
                    cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  ◈ View Full Drum Map
                </button>
              )}

              {/* GM reference */}
              <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>GM Note Mapping:</strong>{' '}
                Kick → C2 (36) · Snare → D2 (38) · Hi-Hat → F#2 (42) · Tom → A2 (45)
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Audio conversion */}
      <div style={{ width: 320, flexShrink: 0, overflowY: 'auto' }}>
        <div className="section-head">
          <span className="panel-label">AUDIO CONVERSION</span>
          <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--text-muted)' }}>FFmpeg</span>
        </div>
        <div style={{ padding: '16px' }}>
          {!audioMeta ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Load audio first
            </div>
          ) : (
            <>
              {/* Format grid */}
              <div className="panel-label" style={{ marginBottom: 10 }}>TARGET FORMAT</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                {FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setAudioFormat(f.value)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${audioFormat === f.value ? 'rgba(255,122,0,0.6)' : 'var(--border)'}`,
                      background: audioFormat === f.value ? 'rgba(255,122,0,0.12)' : 'var(--bg-card)',
                      color: audioFormat === f.value ? 'var(--color-tertiary)' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {lossyFormats.includes(audioFormat) && (
                <div style={{ marginBottom: 14 }}>
                  <div className="panel-label" style={{ marginBottom: 8 }}>BITRATE</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {BITRATES.map(b => (
                      <button
                        key={b}
                        onClick={() => setBitrate(b)}
                        style={{
                          flex: 1, padding: '5px 0',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${bitrate === b ? 'rgba(255,122,0,0.5)' : 'var(--border)'}`,
                          background: bitrate === b ? 'rgba(255,122,0,0.10)' : 'var(--bg-card)',
                          color: bitrate === b ? 'var(--color-tertiary)' : 'var(--text-secondary)',
                          fontSize: 10, cursor: 'pointer',
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={convertAudio}
                disabled={converting}
                style={{
                  width: '100%', padding: '10px',
                  background: converting ? 'rgba(255,122,0,0.06)' : 'rgba(255,122,0,0.14)',
                  border: '1px solid rgba(255,122,0,0.4)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--color-tertiary)', fontWeight: 700, fontSize: 12,
                  cursor: converting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {converting ? 'Starting…' : `CONVERT TO ${audioFormat.toUpperCase()}`}
              </button>

              {convertError && <ErrorBox msg={convertError} />}

              {/* Jobs */}
              {conversionJobs.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="panel-label" style={{ marginBottom: 8 }}>RECENT CONVERSIONS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {conversionJobs.map(job => (
                      <div key={job.job_id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-panel)',
                        border: `1px solid ${job.status === 'done' ? 'rgba(0,255,65,0.2)' : job.status === 'failed' ? 'rgba(255,34,68,0.2)' : 'rgba(255,122,0,0.2)'}`,
                      }}>
                        <span style={{ flexShrink: 0, fontSize: 12 }}>
                          {job.status === 'running' && (
                            <span style={{
                              display: 'inline-block', width: 9, height: 9,
                              border: '1.5px solid rgba(255,122,0,0.3)', borderTopColor: 'var(--color-tertiary)',
                              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                            }} />
                          )}
                          {job.status === 'done' && <span style={{ color: 'var(--color-primary)' }}>✓</span>}
                          {job.status === 'failed' && <span style={{ color: 'var(--color-error)' }}>✗</span>}
                        </span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.filename || `${job.format.toUpperCase()} conversion`}
                        </span>
                        {job.status === 'done' && (
                          <button
                            onClick={() => downloadJob(job)}
                            style={{
                              padding: '3px 8px', borderRadius: 3,
                              background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.3)',
                              color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            }}
                          >↓</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
      background: 'rgba(255,34,68,0.08)', border: '1px solid rgba(255,34,68,0.3)',
      fontSize: 11, color: 'var(--color-error)',
    }}>
      {msg}
    </div>
  )
}
