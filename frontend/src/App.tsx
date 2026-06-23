import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import DAWHeader from './components/DAWHeader'
import DetectView from './views/DetectView'
import MapView from './views/MapView'
import ExportView from './views/ExportView'
import KitManagerView from './views/KitManagerView'
import SessionsModal from './views/SessionsModal'
import SplashScreen from './components/SplashScreen'

export type TabId = 'detect' | 'map' | 'export' | 'kits'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <AppProvider>
        <AppShell />
      </AppProvider>
    </>
  )
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('detect')
  const [sessionsOpen, setSessionsOpen] = useState(false)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      <DAWHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSessionsClick={() => setSessionsOpen(true)}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'detect' && <DetectView onNavigateToTab={setActiveTab} />}
        {activeTab === 'map'    && <MapView />}
        {activeTab === 'export' && <ExportView />}
        {activeTab === 'kits'   && <KitManagerView />}
      </div>
      <StatusBar />
      {sessionsOpen && (
        <SessionsModal
          onClose={() => setSessionsOpen(false)}
          onRestored={() => { setSessionsOpen(false); setActiveTab('detect') }}
        />
      )}
    </div>
  )
}

function StatusBar() {
  const { audioMeta, detectionResult } = useApp()
  const [cpu, setCpu] = useState(0)
  const [mem, setMem] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCpu(Math.round(2 + Math.random() * 6))
      setMem(Math.round(128 + Math.random() * 24))
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const status = detectionResult ? 'DETECTED' : audioMeta ? 'AUDIO LOADED' : 'READY'
  const statusColor = detectionResult ? '#22C55E' : audioMeta ? '#3B82F6' : 'var(--text-muted)'
  const projectName = audioMeta?.file_name ?? 'No project'

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 22,
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      flexShrink: 0,
      fontSize: 9, fontWeight: 600, letterSpacing: '0.07em',
      color: 'var(--text-muted)',
      userSelect: 'none', overflow: 'hidden',
    }}>
      <SCell style={{ borderRight: '1px solid var(--border)', paddingLeft: 12, gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: statusColor }}>{status}</span>
      </SCell>
      <SCell style={{ flex: 1, borderRight: '1px solid var(--border)', gap: 6 }}>
        <span>PROJECT</span>
        <span className="mono" style={{
          color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
        }}>{projectName}</span>
      </SCell>
      {detectionResult && (
        <SCell style={{ borderRight: '1px solid var(--border)', gap: 6 }}>
          <span>HITS</span>
          <span className="mono" style={{ color: '#22C55E' }}>{detectionResult.total_hits}</span>
        </SCell>
      )}
      <div style={{ flex: 1 }} />
      <SCell style={{ borderLeft: '1px solid var(--border)', gap: 5 }}>
        <span>CPU</span>
        <span className="mono" style={{ color: cpu > 60 ? '#F97316' : 'var(--text-secondary)', minWidth: 26 }}>{cpu}%</span>
      </SCell>
      <SCell style={{ borderLeft: '1px solid var(--border)', paddingRight: 12, gap: 5 }}>
        <span>MEM</span>
        <span className="mono" style={{ color: 'var(--text-secondary)', minWidth: 42 }}>{mem} MB</span>
      </SCell>
    </div>
  )
}

function SCell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: '100%', gap: 5, ...style }}>
      {children}
    </div>
  )
}
