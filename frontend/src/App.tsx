import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import DAWHeader from './components/DAWHeader'
import DetectView from './views/DetectView'
import MapView from './views/MapView'
import ExportView from './views/ExportView'
import KitManagerView from './views/KitManagerView'
import SessionsModal from './views/SessionsModal'

export type TabId = 'detect' | 'map' | 'export' | 'kits'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('detect')
  const [sessionsOpen, setSessionsOpen] = useState(false)

  return (
    <AppProvider>
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
          {activeTab === 'detect'  && <DetectView onNavigateToTab={setActiveTab} />}
          {activeTab === 'map'     && <MapView />}
          {activeTab === 'export'  && <ExportView />}
          {activeTab === 'kits'    && <KitManagerView />}
        </div>
        {sessionsOpen && (
          <SessionsModal
            onClose={() => setSessionsOpen(false)}
            onRestored={() => { setSessionsOpen(false); setActiveTab('detect') }}
          />
        )}
      </div>
    </AppProvider>
  )
}
