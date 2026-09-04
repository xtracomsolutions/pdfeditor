import { useApp } from '../state/store'
import { useOpenFiles } from '../lib/useOpenFiles'
import {
  IconDownload,
  IconFit,
  IconMoon,
  IconOcr,
  IconOutline,
  IconPages,
  IconPlus,
  IconRedo,
  IconSearch,
  IconSliders,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
} from './icons'

function ChromeButton({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick?: () => void
  title: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-md transition disabled:opacity-30 ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-chrome-muted hover:bg-white/8 hover:text-chrome-text'
      }`}
    >
      {children}
    </button>
  )
}

export function TopBar() {
  const { pickFiles } = useOpenFiles()
  const {
    ui,
    activeDoc,
    setZoom,
    setFitMode,
    toggleNight,
    togglePanel,
    setSearch,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useApp()
  const doc = activeDoc()
  const zoomPct = Math.round(ui.zoom * 100)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-chrome-line bg-ink px-3">
      <img
        src="/brand/logo-horizontal.jpg"
        alt="Xtracom Solutions"
        className="h-7 rounded"
      />
      <div className="mx-1 h-5 w-px bg-chrome-line" />
      <span className="font-display text-sm font-semibold tracking-wide text-chrome-text">
        Redline
      </span>

      {doc && (
        <>
          <div className="mx-1 h-5 w-px bg-chrome-line" />
          <span className="max-w-[240px] truncate text-sm text-chrome-muted">
            {doc.name}
            {doc.dirty && <span className="ml-1 text-accent">•</span>}
          </span>
        </>
      )}

      <div className="flex-1" />

      {doc && (
        <>
          <ChromeButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo()}>
            <IconUndo />
          </ChromeButton>
          <ChromeButton
            title="Redo (Ctrl+Y)"
            onClick={redo}
            disabled={!canRedo()}
          >
            <IconRedo />
          </ChromeButton>
          <div className="mx-1 h-5 w-px bg-chrome-line" />

          <ChromeButton
            title="Zoom out"
            onClick={() => setZoom(ui.zoom - 0.15)}
          >
            <IconZoomOut />
          </ChromeButton>
          <button
            onClick={() => setZoom(1, 'actual')}
            className="min-w-[52px] rounded-md px-1 py-1 text-center text-xs text-chrome-muted hover:bg-white/8 hover:text-chrome-text"
            title="Actual size"
          >
            {zoomPct}%
          </button>
          <ChromeButton title="Zoom in" onClick={() => setZoom(ui.zoom + 0.15)}>
            <IconZoomIn />
          </ChromeButton>
          <ChromeButton
            title="Fit width"
            active={ui.fitMode === 'width'}
            onClick={() => setFitMode('width')}
          >
            <IconFit />
          </ChromeButton>
          <div className="mx-1 h-5 w-px bg-chrome-line" />

          <ChromeButton
            title="Pages"
            active={ui.showThumbnails}
            onClick={() => togglePanel('showThumbnails')}
          >
            <IconPages />
          </ChromeButton>
          <ChromeButton
            title="Outline"
            active={ui.showOutline}
            onClick={() => togglePanel('showOutline')}
          >
            <IconOutline />
          </ChromeButton>
          <ChromeButton
            title="Properties"
            active={ui.showProperties}
            onClick={() => togglePanel('showProperties')}
          >
            <IconSliders />
          </ChromeButton>
          <ChromeButton
            title="Find (Ctrl+F)"
            active={ui.searchOpen}
            onClick={() => setSearch(!ui.searchOpen)}
          >
            <IconSearch />
          </ChromeButton>
          <ChromeButton
            title="Night mode"
            active={ui.nightMode}
            onClick={toggleNight}
          >
            <IconMoon />
          </ChromeButton>
          {doc && !doc.textLayerReady && (
            <ChromeButton title="Run OCR (scanned document)">
              <IconOcr />
            </ChromeButton>
          )}
          <div className="mx-1 h-5 w-px bg-chrome-line" />
          <button
            className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-dark"
            title="Export PDF"
          >
            <IconDownload width={15} height={15} />
            Export
          </button>
        </>
      )}

      <div className="mx-1 h-5 w-px bg-chrome-line" />
      <button
        onClick={pickFiles}
        className="flex h-8 items-center gap-1.5 rounded-md border border-chrome-line px-2.5 text-xs text-chrome-muted transition hover:border-accent hover:text-chrome-text"
        title="Open PDF"
      >
        <IconPlus width={15} height={15} />
        Open
      </button>
    </header>
  )
}
