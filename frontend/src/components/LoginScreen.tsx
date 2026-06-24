import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
      gap: 28,
      userSelect: 'none',
    }}>
      <img
        src="/drumtracker-logo.png"
        alt="DrumTracker"
        style={{
          height: 64,
          width: 'auto',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 14px rgba(0,200,255,0.45))',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}>
          DrumTracker
        </h1>
        <p style={{
          margin: '8px 0 0',
          fontSize: 12,
          color: 'var(--text-muted)',
          maxWidth: 320,
          lineHeight: 1.5,
        }}>
          Sign in to access your private sessions, uploads, and detection results.
        </p>
      </div>
      <button
        onClick={login}
        style={{
          padding: '11px 26px',
          background: 'var(--color-primary)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          color: '#0b0d10',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(249,115,22,0.35)',
        }}
      >
        Log in with Replit
      </button>
    </div>
  )
}
