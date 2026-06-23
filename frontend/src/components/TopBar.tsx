import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

interface Route { path: string; label: string; icon: string }

export default function TopBar({ routes }: { routes: Route[] }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { audioMeta, detectionResult, conversionJobs } = useApp()

  const current = routes.find(r =>
    r.path === '/' ? location.pathname === '/' : location.pathname.startsWith(r.path)
  )

  const runningJobs = conversionJobs.filter(j => j.status === 'running')
  const doneJobs    = conversionJobs.filter(j => j.status === 'done')

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18 }}>{current?.icon}</span>
        <h1 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.02em',
        }}>
          {current?.label ?? 'DrumTracker'}
        </h1>
      </div>

      {/* Status pills + jobs badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {audioMeta && (
          <StatusPill color="var(--color-secondary)" label={`Audio: ${audioMeta.file_name}`} />
        )}
        {detectionResult && (
          <StatusPill color="var(--color-primary)" label={`${detectionResult.total_hits} hits detected`} />
        )}

        {/* Conversion jobs badge — navigate to /audio on click */}
        {conversionJobs.length > 0 && (
          <button
            onClick={() => navigate('/audio')}
            title="View conversion jobs"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: runningJobs.length > 0 ? 'rgba(255,122,0,0.12)' : 'rgba(0,255,127,0.08)',
              border: `1px solid ${runningJobs.length > 0 ? 'rgba(255,122,0,0.4)' : 'rgba(0,255,127,0.3)'}`,
              cursor: 'pointer', outline: 'none',
              fontSize: 11, color: runningJobs.length > 0 ? 'var(--color-tertiary)' : 'var(--color-primary)',
            }}
          >
            {runningJobs.length > 0 ? (
              <Spinner />
            ) : (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
            )}
            {runningJobs.length > 0
              ? `Converting ${runningJobs.length} file${runningJobs.length > 1 ? 's' : ''}…`
              : `${doneJobs.length} conversion${doneJobs.length > 1 ? 's' : ''} ready`}
          </button>
        )}
      </div>
    </header>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 10, height: 10,
      border: '2px solid rgba(255,122,0,0.3)',
      borderTopColor: 'var(--color-tertiary)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      fontSize: 11,
      color: 'var(--text-secondary)',
      maxWidth: 200,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )
}
