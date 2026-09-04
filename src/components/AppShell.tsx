import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../state/store'
import { useOpenFiles } from '../lib/useOpenFiles'
import { TopBar } from './TopBar'
import { TabStrip } from './TabStrip'
import { Toolbar } from './Toolbar'
import { ThumbnailRail } from './ThumbnailRail'
import { OutlinePanel } from './OutlinePanel'
import { PropertiesPanel } from './PropertiesPanel'
import { SearchBar } from './SearchBar'
import { StartScreen } from './StartScreen'
import { Viewer } from './viewer/Viewer'

export function AppShell() {
  const docs = useApp((s) => s.docs)
  const doc = useApp((s) => s.docs.find((d) => d.id === s.activeDocId) ?? null)
  const ui = useApp((s) => s.ui)
  const { undo, redo, setSearch, setTool } = useApp()
  const { openFiles, openBytes } = useOpenFiles()
  const [dragging, setDragging] = useState(false)

  // dev-only: load a PDF by URL from the console (window.__openPdf('/x.pdf'))
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __openPdf: (u: string) => void }).__openPdf = async (
      url: string,
    ) => {
      const r = await fetch(url)
      const b = new Uint8Array(await r.arrayBuffer())
      await openBytes(url.split('/').pop() || 'document.pdf', b, b.length)
    }
  }, [openBytes])

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearch(true)
      } else if (!typing && !mod) {
        const map: Record<string, Parameters<typeof setTool>[0]> = {
          v: 'select',
          h: 'hand',
          k: 'highlight',
          d: 'ink',
          t: 'textbox',
          r: 'redact',
          s: 'signature',
        }
        if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, setSearch, setTool])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files?.length) void openFiles(e.dataTransfer.files)
    },
    [openFiles],
  )

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <TopBar />
      <TabStrip />

      <div className="relative flex min-h-0 flex-1">
        {docs.length > 0 && <Toolbar />}

        {doc && ui.showOutline && <OutlinePanel doc={doc} />}
        {doc && ui.showThumbnails && <ThumbnailRail doc={doc} />}

        <main className="relative min-w-0 flex-1">
          {doc ? <Viewer doc={doc} /> : <StartScreen />}
          {doc && ui.searchOpen && <SearchBar doc={doc} />}
        </main>

        {doc && ui.showProperties && <PropertiesPanel doc={doc} />}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-50 m-3 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-ink/70 backdrop-blur-sm">
            <span className="font-display text-lg font-semibold text-accent">
              Drop PDF to open
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
