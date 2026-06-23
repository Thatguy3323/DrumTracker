import { createContext, useContext, useState, ReactNode } from 'react'

export interface AudioMeta {
  audio_id: string
  file_name: string
  sample_rate: number
  channels: number
  duration: number
  format: string
  total_frames: number
}

export interface DrumHit {
  id: string
  timestamp: number
  drum_type: string
  velocity: number
  confidence: number
  frequency_centroid?: number
}

export interface DetectionResult {
  detection_id: string
  audio_id: string
  total_hits: number
  hits_by_type: Record<string, number>
  confidence: number
  processing_time: number
  hits: DrumHit[]
  completed_at: string
}

interface AppState {
  audioMeta: AudioMeta | null
  setAudioMeta: (m: AudioMeta | null) => void
  waveformPeaks: number[]
  setWaveformPeaks: (p: number[]) => void
  detectionResult: DetectionResult | null
  setDetectionResult: (r: DetectionResult | null) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [audioMeta, setAudioMeta] = useState<AudioMeta | null>(null)
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([])
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)

  return (
    <AppContext.Provider value={{
      audioMeta, setAudioMeta,
      waveformPeaks, setWaveformPeaks,
      detectionResult, setDetectionResult,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
