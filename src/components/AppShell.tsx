import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../state/store'
import { useOpenFiles } from '../lib/useOpenFiles'
import { usePageOps } from '../lib/usePageOps'
import { useAutosave } from '../lib/useAutosave'
import { TopBar } from './TopBar'
import { TabStrip } from './TabStrip'
import { ToolOptionsBar } from './ToolOptionsBar'
import { Toolbar } from './Toolbar'
import { ThumbnailRail } from './ThumbnailRail'
import { OutlinePanel } from './OutlinePanel'
import { PropertiesPanel } from './PropertiesPanel'
import { SearchBar } from './SearchBar'
import { SignatureDialog } from './SignatureDialog'
import { StampPalette } from './StampPalette'
import { StartScreen } from './StartScreen'
import { Viewer } from './viewer/Viewer'
import { nanoid } from '../lib/id'
import { putAsset } from '../lib/storage/db'

export function AppShell() {
  const hasDocs = useApp((s) => s.docs.length > 0)
  const doc = useApp((s) => s.docs.find((d) => d.id === s.activeDocId) ?? null)
  const ui = useApp((s) => s.ui)
  const undo = useApp((s) => s.undo)
  const redo = useApp((s) => s.redo)
  const setSearch = useApp((s) => s.setSearch)
  const setTool = useApp((s) => s.setTool)
  const removeAnnotations = useApp((s) => s.removeAnnotations)
  const select = useApp((s) => s.select)
  const selectedIds = useApp((s) => s.ui.selectedIds)
  const setPlacement = useApp((s) => s.setPlacement)
  const { openFiles, openBytes } = useOpenFiles()
  const pageOps = usePageOps()
  const [dragging, setDragging] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  useAutosave()

  // signature tool with nothing armed -> open the signature dialog
  useEffect(() => {
    if (ui.activeTool === 'signature' && !ui.placement) setSigOpen(true)
  }, [ui.activeTool, ui.placement])

  // image tool with nothing armed -> pick a file and arm placement
  useEffect(() => {
    if (ui.activeTool !== 'image' || ui.placement) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) {
        setTool('select')
        return
      }
      const assetId = nanoid()
      await putAsset(assetId, f)
      const bmp = await createImageBitmap(f)
      setPlacement({
        kind: 'image',
        assetId,
        aspect: bmp.width / bmp.height,
      })
    }
    input.oncancel = () => setTool('select')
    input.click()
  }, [ui.activeTool, ui.placement, setPlacement, setTool])

  // dev-only console helpers
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__openPdf = async (url: string) => {
      const r = await fetch(url)
      const b = new Uint8Array(await r.arrayBuffer())
      await openBytes(url.split('/').pop() || 'document.pdf', b, b.length)
    }
    w.__mergePdf = async (url: string) => {
      const r = await fetch(url)
      const f = new File([await r.blob()], url.split('/').pop() || 'merge.pdf', {
        type: 'application/pdf',
      })
      await pageOps.mergePdf([f])
    }
  }, [openBytes, pageOps])

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearch(true)
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedIds.length) {
          e.preventDefault()
          removeAnnotations(selectedIds)
        }
      } else if (!typing && e.key === 'Escape') {
        select([])
        setTool('select')
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
  }, [undo, redo, setSearch, setTool, removeAnnotations, select, selectedIds])

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
      {doc && <ToolOptionsBar />}
      {doc && ui.activeTool === 'stamp' && !ui.placement && <StampPalette />}
      <SignatureDialog
        open={sigOpen}
        onOpenChange={(v) => {
          setSigOpen(v)
          if (!v) {
            const st = useApp.getState()
            if (st.ui.activeTool === 'signature' && !st.ui.placement)
              setTool('select')
          }
        }}
      />

      <div className="relative flex min-h-0 flex-1">
        {hasDocs && <Toolbar />}

        {/* Below ~1100px the side panels float over the viewer instead of
            squeezing it — a normal desktop window keeps the pushed layout. */}
        {doc && ui.showOutline && (
          <div
            className="absolute inset-y-0 z-30 shadow-2xl min-[1100px]:static min-[1100px]:z-auto min-[1100px]:shadow-none"
            style={{ left: hasDocs ? 56 : 0 }}
          >
            <OutlinePanel doc={doc} />
          </div>
        )}
        {doc && ui.showThumbnails && (
          <div
            className="absolute inset-y-0 z-30 shadow-2xl min-[1100px]:static min-[1100px]:z-auto min-[1100px]:shadow-none"
            style={{ left: (hasDocs ? 56 : 0) + (ui.showOutline ? 256 : 0) }}
          >
            <ThumbnailRail doc={doc} />
          </div>
        )}

        <main className="relative min-w-0 flex-1">
          {doc ? <Viewer doc={doc} /> : <StartScreen />}
          {doc && ui.searchOpen && <SearchBar doc={doc} />}
        </main>

        {doc && ui.showProperties && (
          <div className="absolute inset-y-0 right-0 z-30 shadow-2xl min-[1100px]:static min-[1100px]:z-auto min-[1100px]:shadow-none">
            <PropertiesPanel doc={doc} />
          </div>
        )}

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
