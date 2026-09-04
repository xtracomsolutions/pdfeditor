import { useApp } from '../state/store'
import { disposePdf } from '../lib/pdf/registry'
import { IconX } from './icons'

export function TabStrip() {
  const docs = useApp((s) => s.docs)
  const activeDocId = useApp((s) => s.activeDocId)
  const setActiveDoc = useApp((s) => s.setActiveDoc)
  const closeDoc = useApp((s) => s.closeDoc)

  if (docs.length <= 1) return null

  return (
    <div className="chrome-scroll flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b border-chrome-line bg-ink">
      {docs.map((d) => {
        const on = d.id === activeDocId
        return (
          <div
            key={d.id}
            className={`group flex min-w-[130px] max-w-[220px] items-center gap-2 border-r border-chrome-line px-3 text-xs ${
              on
                ? 'bg-ink-2 text-chrome-text'
                : 'text-chrome-muted hover:bg-white/5'
            }`}
          >
            <button
              className="flex-1 truncate text-left"
              onClick={() => setActiveDoc(d.id)}
            >
              {d.name}
              {d.dirty && <span className="ml-1 text-accent">•</span>}
            </button>
            <button
              className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100"
              onClick={() => {
                closeDoc(d.id)
                disposePdf(d.id)
              }}
              aria-label={`Close ${d.name}`}
            >
              <IconX width={13} height={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
