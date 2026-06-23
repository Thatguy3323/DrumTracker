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

export default function KitManagerView() {
  const { selectedKit, setSelectedKit } = useApp()
  const selected = KITS.find(k => k.id === selectedKit)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Kit grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="section-head">
          <span className="panel-label">KIT MANAGER</span>
          {selected && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-primary)' }}>
              {selected.name} selected
            </span>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Select a drum kit. The kit profile shapes MIDI velocity curves and note assignments on export.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {KITS.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                selected={selectedKit === kit.id}
                onSelect={() => setSelectedKit(kit.id === selectedKit ? null : kit.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected kit detail */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
        <div className="section-head">
          <span className="panel-label">KIT DETAIL</span>
        </div>
        <div style={{ padding: '20px' }}>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>{selected.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Tag color={selected.color}>{selected.style}</Tag>
                  <Tag color="var(--text-muted)">{selected.bpm} BPM</Tag>
                </div>
              </div>

              <div style={{
                padding: '14px', background: 'var(--bg-card)',
                border: `1px solid ${selected.color}44`, borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{selected.desc}</div>
              </div>

              {/* MIDI note mapping for this kit */}
              <div>
                <div className="panel-label" style={{ marginBottom: 8 }}>NOTE MAPPING</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { type: 'kick',  note: 'C2 (36)',  color: '#FF2244' },
                    { type: 'snare', note: 'D2 (38)',  color: '#00C8FF' },
                    { type: 'hihat', note: 'F#2 (42)', color: '#00FF41' },
                    { type: 'tom',   note: 'A2 (45)',  color: '#FF7A00' },
                  ].map(({ type, note, color }) => (
                    <div key={type} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase' }}>{type}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedKit(null)}
                style={{
                  padding: '8px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
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
              <div style={{ fontSize: 40, opacity: 0.15 }}>◉</div>
              <div style={{ fontSize: 12 }}>Select a kit to view its detail and note mapping.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KitCard({
  kit, selected, onSelect,
}: { kit: typeof KITS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? `${kit.color}10` : 'var(--bg-card)',
        border: `1px solid ${selected ? kit.color + '55' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '18px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
        outline: 'none',
        boxShadow: selected ? `0 0 14px ${kit.color}18` : 'none',
      }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 18, height: 18, borderRadius: '50%',
          background: kit.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#000',
        }}>✓</span>
      )}
      <div style={{ fontSize: 26, marginBottom: 10 }}>{kit.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>
        {kit.name}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <Tag color={kit.color}>{kit.style}</Tag>
        <Tag color="var(--text-muted)">{kit.bpm} BPM</Tag>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>{kit.desc}</div>
    </button>
  )
}

function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
      padding: '2px 7px', borderRadius: 20,
      background: color + '22', color,
      border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  )
}
