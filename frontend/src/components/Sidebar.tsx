import { NavLink } from 'react-router-dom'

interface Route { path: string; label: string; icon: string }

export default function Sidebar({ routes }: { routes: Route[] }) {
  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 16px 24px' }}>
        <img
          src="/logo-wordmark.png"
          alt="DrumTracker"
          style={{ width: '100%', maxWidth: 190, display: 'block' }}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 20px 16px' }} />

      {/* Nav links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {routes.map(r => (
          <NavLink
            key={r.path}
            to={r.path}
            end={r.path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(0,255,127,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            <span style={{ fontSize: 16, opacity: 0.85 }}>{r.icon}</span>
            {r.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div>v1.0.0 · librosa DSP</div>
          <div style={{ color: 'var(--color-primary)', marginTop: 2 }}>● ONLINE</div>
        </div>
      </div>
    </aside>
  )
}
