import { useState } from 'react'
import { useApp } from '../state/store'
import type { Placement } from '../state/store'

const PRESETS: { label: string; style: Placement['stampStyle']; color: string }[] =
  [
    { label: 'APPROVED', style: 'approved', color: '#30a46c' },
    { label: 'DRAFT', style: 'draft', color: '#8e8e8e' },
    { label: 'CONFIDENTIAL', style: 'confidential', color: '#e5484d' },
    { label: 'RECEIVED', style: 'received', color: '#3b5bdb' },
    { label: 'REVISED', style: 'custom', color: '#f5a623' },
    { label: 'FINAL', style: 'custom', color: '#30a46c' },
  ]

export function StampPalette() {
  const setPlacement = useApp((s) => s.setPlacement)
  const [custom, setCustom] = useState('')

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-chrome-line bg-ink-2 px-3 text-xs">
      <span className="uppercase tracking-wide text-chrome-muted">Stamp</span>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() =>
            setPlacement({
              kind: 'stamp',
              label: p.label,
              stampStyle: p.style,
              color: p.color,
            })
          }
          className="rounded border px-2 py-0.5 font-display font-bold"
          style={{ color: p.color, borderColor: p.color }}
        >
          {p.label}
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-chrome-line" />
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="Custom text"
        className="h-6 w-28 rounded border border-chrome-line bg-ink px-2 text-chrome-text outline-none focus:border-accent"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && custom.trim())
            setPlacement({
              kind: 'stamp',
              label: custom.toUpperCase(),
              stampStyle: 'custom',
            })
        }}
      />
    </div>
  )
}
