import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'

const KITS = [
  { id: 'rock',       name: 'Rock Standard',    style: 'Rock',       bpm: '80–140',  desc: 'Punchy kick, cracking snare, crisp cymbals. Analog warmth.',        color: '#FF2244', icon: '🥁' },
  { id: 'jazz',       name: 'Jazz Brushes',     style: 'Jazz',       bpm: '60–200',  desc: 'Soft brushed snare, tight hi-hats, warm kick. Room ambience.',      color: '#FF7A00', icon: '🎷' },
  { id: 'electronic', name: 'Electronic 808',   style: 'Electronic', bpm: '90–160',  desc: 'Deep sub-bass kick, clipped snare, closed hi-hats. Club ready.',    color: '#00C8FF', icon: '⚡' },
  { id: 'hiphop',     name: 'Hip-Hop SP',       style: 'Hip-Hop',    bpm: '70–120',  desc: 'Sampled vinyl kicks, dusty snares, lo-fi texture.',                 color: '#00FF41', icon: '🎤' },
  { id: 'metal',      name: 'Metal Blast',      style: 'Metal',      bpm: '140–260', desc: 'Triggered double-kick, bright snare, fast hi-hat machine gun.',     color: '#AA44FF', icon: '🤘' },
  { id: 'latin',      name: 'Latin Percussion', style: 'Latin',      bpm: '100–180', desc: 'Congas, timbales, woodblocks, cajon, and shakers.',                 color: '#FFD700', icon: '🎵' },
]

const NOTE_MAP = [
  { type: 'kick',       note: 'C2 (36)',   color: '#FF2244' },
  { type: 'snare',      note: 'D2 (38)',   color: '#00C8FF' },
  { type: 'hihat',      note: 'F#2 (42)',  color: '#00FF41' },
  { type: 'hihat_open', note: 'A#2 (46)',  color: '#44FF88' },
  { type: 'tom_high',   note: 'A2 (45)',   color: '#FF7A00' },
  { type: 'tom_mid',    note: 'G2 (43)',   color: '#FF9A40' },
  { type: 'tom_low',    note: 'E2 (41)',   color: '#FFB870' },
  { type: 'crash',      note: 'C#3 (49)',  color: '#AA44FF' },
  { type: 'ride',       note: 'D#3 (51)',  color: '#FFD700' },
]

type KitControls = { volume: number; muted: boolean; soloed: boolean }
type ControlsMap = Record<string, KitControls>

const DEFAULT_CONTROLS: KitControls = { volume: 80, muted: false, soloed: false }

export default function KitManagerView() {
  const { selectedKit, setSelectedKit } = useApp()
  const [controls, setControls] = useState<ControlsMap>(() =>
    Object.fromEntries(KITS.map(k => [k.id, { ...DEFAULT_CONTROLS }]))
  )
  const [previewing, setPreviewing] = useState<string | null>(null)
  const previewRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = KITS.find(k => k.id === selectedKit)

  function updateControl(id: string, patch: Partial<KitControls>) {
    setControls(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function handleSolo(id: string) {
    const isSoloed = controls[id].soloed
    setControls(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], soloed: false } })
      if (!isSoloed) next[id] = { ...next[id], soloed: true }
      return next
    })
  }

  function handlePreview(id: string) {
    if (previewRef.current) clearTimeout(previewRef.current)
    setPreviewing(id)
    previewRef.current = setTimeout(() => setPreviewing(null), 1800)
  }

  const ctrl = selectedKit ? controls[selectedKit] ?? DEFAULT_CONTROLS : DEFAULT_CONTROLS

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Kit grid ────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="section-head">
          <span className="panel-label">KIT MANAGER</span>
          {selected && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-primary)' }}>
              {selected.name} active
            </span>
          )}
        </div>

        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Select a kit to shape MIDI velocity curves and note assignments on export.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {KITS.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                selected={selectedKit === kit.id}
                ctrl={controls[kit.id]}
                previewing={previewing === kit.id}
                onSelect={() => setSelectedKit(kit.id === selectedKit ? null : kit.id)}
                onVolume={v => updateControl(kit.id, { volume: v })}
                onMute={() => updateControl(kit.id, { muted: !controls[kit.id].muted })}
                onSolo={() => handleSolo(kit.id)}
                onPreview={() => handlePreview(kit.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Kit detail ─────────────────────────────── */}
      <div style={{ width: 290, flexShrink: 0, borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
        <div className="section-head">
          <span className="panel-label">KIT DETAIL</span>
        </div>
        <div style={{ padding: '16px' }}>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Identity */}
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 46, marginBottom: 8 }}>{selected.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>{selected.name}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Tag color={selected.color}>{selected.style}</Tag>
                  <Tag color="var(--text-muted)">{selected.bpm} BPM</Tag>
                </div>
              </div>

              {/* Description */}
              <div style={{
                padding: '12px', background: 'var(--bg-card)',
                border: `1px solid ${selected.color}44`, borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{selected.desc}</div>
              </div>

              {/* ── Volume slider ─────────────────── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="panel-label">VOLUME</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--color-primary)' }}>{ctrl.volume}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={1} value={ctrl.volume}
                  onChange={e => updateControl(selected.id, { volume: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: selected.color, cursor: 'pointer' }}
                />
              </div>

              {/* ── Solo / Mute / Preview ─────────── */}
              <div>
                <div className="panel-label" style={{ marginBottom: 8 }}>CONTROLS</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <DawButton
                    label="SOLO"
                    active={ctrl.soloed}
                    activeColor="#FFD700"
                    onClick={() => handleSolo(selected.id)}
                  />
                  <DawButton
                    label="MUTE"
                    active={ctrl.muted}
                    activeColor="#FF2244"
                    onClick={() => updateControl(selected.id, { muted: !ctrl.muted })}
                  />
                  <DawButton
                    label={previewing === selected.id ? '▶ PLAYING' : '▶ PREVIEW'}
                    active={previewing === selected.id}
                    activeColor={selected.color}
                    onClick={() => handlePreview(selected.id)}
                  />
                </div>
              </div>

              {/* ── Note mapping ──────────────────── */}
              <div>
                <div className="panel-label" style={{ marginBottom: 8 }}>NOTE MAPPING</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {NOTE_MAP.map(({ type, note, color }) => (
                    <div key={type} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{type.replace('_', ' ')}</span>
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedKit(null)}
                style={{
                  padding: '7px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Clear selection
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 0',
              color: 'var(--text-muted)', textAlign: 'center',
            }}>
              <img src="/drumtracker-logo.png" alt="DrumTracker" style={{ height: 52, opacity: 0.18, marginBottom: 4 }} />
              <div style={{ fontSize: 12 }}>Select a kit to view controls and note mapping.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KitCard({
  kit, selected, ctrl, previewing, onSelect, onVolume, onMute, onSolo, onPreview,
}: {
  kit: typeof KITS[0]
  selected: boolean
  ctrl: KitControls
  previewing: boolean
  onSelect: () => void
  onVolume: (v: number) => void
  onMute: () => void
  onSolo: () => void
  onPreview: () => void
}) {
  return (
    <div style={{
      background: selected ? `${kit.color}0E` : 'var(--bg-card)',
      border: `1px solid ${selected ? kit.color + '55' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '14px',
      position: 'relative',
      boxShadow: selected ? `0 0 14px ${kit.color}18` : 'none',
      transition: 'all 0.15s ease',
    }}>
      {/* Select toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <button
          onClick={onSelect}
          style={{
            width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? kit.color : 'var(--border)'}`,
            background: selected ? kit.color : 'transparent',
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontSize: 9, fontWeight: 700,
          }}
        >{selected ? '✓' : ''}</button>

        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onSelect}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{kit.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{kit.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Tag color={kit.color}>{kit.style}</Tag>
            <Tag color="var(--text-muted)">{kit.bpm} BPM</Tag>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{kit.desc}</div>

      {/* ── Volume ──────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', minWidth: 28 }}>VOL</span>
        <input
          type="range" min={0} max={100} step={1} value={ctrl.volume}
          onChange={e => { e.stopPropagation(); onVolume(Number(e.target.value)) }}
          style={{ flex: 1, accentColor: kit.color, cursor: 'pointer' }}
        />
        <span className="mono" style={{ fontSize: 9, color: kit.color, minWidth: 24, textAlign: 'right' }}>{ctrl.volume}</span>
      </div>

      {/* ── Solo / Mute / Preview ───── */}
      <div style={{ display: 'flex', gap: 5 }}>
        <SmallBtn label="SOLO" active={ctrl.soloed} color="#FFD700" onClick={onSolo} />
        <SmallBtn label="MUTE" active={ctrl.muted} color="#FF2244" onClick={onMute} />
        <SmallBtn label={previewing ? '▶ ON' : '▶'} active={previewing} color={kit.color} onClick={onPreview} />
      </div>
    </div>
  )
}

function SmallBtn({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        padding: '3px 7px', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? color + '30' : 'transparent',
        color: active ? color : 'var(--text-muted)',
      }}
    >{label}</button>
  )
}

function DawButton({ label, active, activeColor, onClick }: { label: string; active: boolean; activeColor: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '7px 4px',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
        border: `1px solid ${active ? activeColor : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? activeColor + '25' : 'transparent',
        color: active ? activeColor : 'var(--text-muted)',
      }}
    >{label}</button>
  )
}

function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
      padding: '2px 6px', borderRadius: 20,
      background: color + '22', color,
      border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  )
}
