import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'
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

export default function DAWHeader({ activeTab, onTabChange, onSessionsClick }: Props) {
  const { audioMeta, detectionResult, conversionJobs } = useApp()
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
        gap: 9,
        padding: '0 18px',
        borderRight: '1px solid var(--border)',
        minWidth: 168,
        flexShrink: 0,
      }}>
        <DrumSvg />
        <span style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--color-primary)',
        }}>
          DRUM<span style={{ color: 'var(--text-muted)' }}>TRACKER</span>
        </span>
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
                background: active ? 'rgba(0,255,65,0.06)' : 'transparent',
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
              border: '1.5px solid rgba(255,122,0,0.3)', borderTopColor: 'var(--color-tertiary)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            {runningJobs.length} converting
          </Pill>
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

function DrumSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="7.5" rx="7" ry="3" stroke="var(--color-primary)" strokeWidth="1.4" />
      <line x1="3" y1="7.5" x2="3" y2="13.5" stroke="var(--color-primary)" strokeWidth="1.4" />
      <line x1="17" y1="7.5" x2="17" y2="13.5" stroke="var(--color-primary)" strokeWidth="1.4" />
      <ellipse cx="10" cy="13.5" rx="7" ry="3" stroke="var(--color-primary)" strokeWidth="1.4" fill="rgba(0,255,65,0.05)" />
    </svg>
  )
}
