import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

interface Route { path: string; label: string; icon: string }

export default function TopBar({ routes }: { routes: Route[] }) {
  const location = useLocation()
  const { audioMeta, detectionResult } = useApp()

  const current = routes.find(r =>
    r.path === '/' ? location.pathname === '/' : location.pathname.startsWith(r.path)
  )

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

      {/* Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {audioMeta && (
          <StatusPill color="var(--color-secondary)" label={`Audio: ${audioMeta.file_name}`} />
        )}
        {detectionResult && (
          <StatusPill color="var(--color-primary)" label={`${detectionResult.total_hits} hits detected`} />
        )}
      </div>
    </header>
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
