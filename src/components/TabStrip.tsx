import { useState } from 'react'
import { useApp } from '../state/store'
import { disposePdf } from '../lib/pdf/registry'
import { usePageOps } from '../lib/usePageOps'
import { PAGE_DRAG_MIME, readPageDrag } from '../lib/dnd'
import { IconX } from './icons'

export function TabStrip() {
  const docs = useApp((s) => s.docs)
  const activeDocId = useApp((s) => s.activeDocId)
  const setActiveDoc = useApp((s) => s.setActiveDoc)
  const closeDoc = useApp((s) => s.closeDoc)
  const { movePageAcrossDocs } = usePageOps()
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  if (docs.length <= 1) return null

  return (
    <div className="chrome-scroll flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b border-chrome-line bg-ink">
      {docs.map((d) => {
        const on = d.id === activeDocId
        return (
          <div
            key={d.id}
            className={`group flex min-w-[130px] max-w-[220px] items-center gap-2 border-r border-chrome-line px-3 text-xs transition ${
              on
                ? 'bg-ink-2 text-chrome-text'
                : 'text-chrome-muted hover:bg-white/5'
            } ${dropTarget === d.id ? 'ring-1 ring-inset ring-accent bg-accent/10' : ''}`}
            title="Drag a page thumbnail here to move it into this document (hold Alt to copy)"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(PAGE_DRAG_MIME)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'
              setDropTarget(d.id)
            }}
            onDragLeave={() => setDropTarget((t) => (t === d.id ? null : t))}
            onDrop={(e) => {
              e.preventDefault()
              setDropTarget(null)
              const payload = readPageDrag(e.dataTransfer)
              if (!payload || payload.docId === d.id) return
              void movePageAcrossDocs(
                payload.docId,
                payload.pageId,
                d.id,
                undefined,
                e.altKey,
              )
            }}
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
