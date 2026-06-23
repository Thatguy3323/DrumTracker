import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Home from './pages/Home'
import AudioProcessing from './pages/AudioProcessing'
import HitDetection from './pages/HitDetection'
import AIKits from './pages/AIKits'
import MidiExport from './pages/MidiExport'
import { AppProvider } from './context/AppContext'

const ROUTES = [
  { path: '/',               label: 'Home',             icon: '⌂' },
  { path: '/audio',          label: 'Audio Processing',  icon: '◈' },
  { path: '/detection',      label: 'Hit Detection',     icon: '◎' },
  { path: '/kits',           label: 'AI Kits',           icon: '◉' },
  { path: '/export',         label: 'MIDI Export',       icon: '↗' },
]

export { ROUTES }

export default function App() {
  return (
    <AppProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar routes={ROUTES} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopBar routes={ROUTES} />
          <main style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg-primary)',
            padding: '28px 32px',
          }}>
            <Routes>
              <Route path="/"          element={<Home />} />
              <Route path="/audio"     element={<AudioProcessing />} />
              <Route path="/detection" element={<HitDetection />} />
              <Route path="/kits"      element={<AIKits />} />
              <Route path="/export"    element={<MidiExport />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
