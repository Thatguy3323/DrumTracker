import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import type { TabId } from '../App'

const TABS: { id: TabId; label: string }[] = [
  { id: 'detect',  label: 'DETECT'      },
  { id: 'map',     label: 'MAP'         },
  { id: 'export',  label: 'EXPORT'      },
  { id: 'kits',    label: 'KIT MANAGER' },
]

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onSessionsClick: () => void
}

function fmtTime(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function DAWHeader({ activeTab, onTabChange, onSessionsClick }: Props) {
  const { audioMeta, detectionResult, conversionJobs, isPlaying, currentTime } = useApp()
  const { user, logout } = useAuth()
  const runningJobs = conversionJobs.filter(j => j.status === 'running')

  return (
    <header style={{
      height: 'var(--header-height)',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        borderRight: '1px solid var(--border)',
        minWidth: 148,
        flexShrink: 0,
      }}>
        <img
          src="/drumtracker-logo.png"
          alt="DrumTracker"
          style={{ height: 30, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(0,200,255,0.4))' }}
        />
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 22px',
                background: active ? 'rgba(249,115,22,0.07)' : 'transparent',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                borderRight: '1px solid var(--border)',
                color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.09em',
                cursor: 'pointer',
                outline: 'none',
                transition: 'color 0.12s, background 0.12s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Right status + sessions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {audioMeta && (
          <Pill color="var(--color-secondary)">
            <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {audioMeta.file_name}
            </span>
          </Pill>
        )}
        {detectionResult && (
          <Pill color="var(--color-primary)">
            {detectionResult.total_hits} hits
          </Pill>
        )}
        {runningJobs.length > 0 && (
          <Pill color="var(--color-tertiary)">
            <span style={{
              display: 'inline-block', width: 8, height: 8, flexShrink: 0,
              border: '1.5px solid rgba(34,197,94,0.2)', borderTopColor: 'var(--color-tertiary)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            {runningJobs.length} converting
          </Pill>
        )}

        {audioMeta && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 10px',
            borderRadius: 20,
            background: isPlaying ? 'rgba(0,255,127,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isPlaying ? 'rgba(0,255,127,0.3)' : 'var(--border)'}`,
            fontSize: 10, fontWeight: 600,
            color: isPlaying ? 'var(--color-tertiary)' : 'var(--text-muted)',
            transition: 'color 0.2s, background 0.2s, border-color 0.2s',
            flexShrink: 0,
          }}>
            {isPlaying ? (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--color-tertiary)', flexShrink: 0,
                boxShadow: '0 0 6px rgba(0,255,127,0.6)',
              }} />
            ) : (
              <span style={{ fontSize: 8, lineHeight: 1 }}>⏸</span>
            )}
            <span className="mono">{fmtTime(currentTime)}</span>
          </div>
        )}

        <button
          onClick={onSessionsClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.07em',
            cursor: 'pointer',
          }}
        >
          ◷ HISTORY
        </button>

        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            paddingLeft: 10, marginLeft: 2,
            borderLeft: '1px solid var(--border)',
          }}>
            {user.profile_image ? (
              <img
                src={user.profile_image}
                alt={user.name}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  objectFit: 'cover', flexShrink: 0,
                  border: '1px solid var(--border)',
                }}
              />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-primary)', color: '#0b0d10',
                fontSize: 11, fontWeight: 700,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
              maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.name}
            </span>
            <button
              onClick={logout}
              title="Log out"
              style={{
                display: 'flex', alignItems: 'center',
                padding: '4px 9px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
                cursor: 'pointer',
              }}
            >
              LOG OUT
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px',
      borderRadius: 20,
      background: `${color}14`,
      border: `1px solid ${color}44`,
      fontSize: 10, fontWeight: 600,
      color,
      maxWidth: 160,
      overflow: 'hidden',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {children}
    </div>
  )
}


