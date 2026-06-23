import { useState } from 'react'

const KITS = [
  { id: 'rock', name: 'Rock Standard', style: 'Rock', bpm: '80–140', desc: 'Punchy kick, cracking snare, crisp cymbals. Analog warmth.', color: '#FF2244', icon: '🥁' },
  { id: 'jazz', name: 'Jazz Brushes', style: 'Jazz', bpm: '60–200', desc: 'Soft brushed snare, tight hi-hats, warm kick. Room ambience.', color: '#FF7A00', icon: '🎷' },
  { id: 'electronic', name: 'Electronic 808', style: 'Electronic', bpm: '90–160', desc: 'Deep sub-bass kick, clipped snare, closed hi-hats. Club ready.', color: '#00C8FF', icon: '⚡' },
  { id: 'hiphop', name: 'Hip-Hop SP', style: 'Hip-Hop', bpm: '70–120', desc: 'Sampled vinyl kicks, dusty snares, lo-fi texture.', color: '#00FF7F', icon: '🎤' },
  { id: 'metal', name: 'Metal Blast', style: 'Metal', bpm: '140–260', desc: 'Triggered double-kick, bright snare, fast hi-hat machine gun.', color: '#AA44FF', icon: '🤘' },
  { id: 'latin', name: 'Latin Percussion', style: 'Latin', bpm: '100–180', desc: 'Congas, timbales, woodblocks, cajon, and shakers.', color: '#FFD700', icon: '🎵' },
]

export default function AIKits() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div>
      <h2 style={{ marginBottom: 6, fontSize: 18, fontWeight: 600 }}>AI Drum Kits</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 13 }}>
        Select a drum kit to use for replacement. The kit's tuning profile will be applied to detected hits during MIDI export.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {KITS.map(kit => (
          <KitCard
            key={kit.id}
            kit={kit}
            selected={selected === kit.id}
            onSelect={() => setSelected(kit.id === selected ? null : kit.id)}
          />
        ))}
      </div>

      {selected && (
        <div style={{
          marginTop: 28, padding: '16px 20px',
          background: 'rgba(0,255,127,0.06)', border: '1px solid rgba(0,255,127,0.25)',
          borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 24 }}>{KITS.find(k => k.id === selected)?.icon}</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {KITS.find(k => k.id === selected)?.name} selected
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              This kit profile will be used for MIDI velocity curves and note mapping on export.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KitCard({ kit, selected, onSelect }: {
  kit: typeof KITS[0]; selected: boolean; onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? `${kit.color}11` : 'var(--bg-card)',
        border: `1px solid ${selected ? kit.color + '55' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '20px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        outline: 'none',
      }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          width: 20, height: 20, borderRadius: '50%',
          background: kit.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#000',
        }}>✓</span>
      )}

      <div style={{ fontSize: 28, marginBottom: 12 }}>{kit.icon}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{kit.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Tag color={kit.color}>{kit.style}</Tag>
        <Tag color="var(--text-muted)">{kit.bpm} BPM</Tag>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{kit.desc}</div>
    </button>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
      padding: '2px 8px', borderRadius: 10,
      background: color + '22', color,
      border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  )
}
