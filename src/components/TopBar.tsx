import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useApp } from '../state/store'
import { useOpenFiles } from '../lib/useOpenFiles'
import { useExport } from '../lib/useExport'
import { useOcr } from '../lib/useOcr'
import { asset } from '../lib/asset'
import {
  IconChevronDown,
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
    run: runExport,
    runRedacted,
    busy: exporting,
    hasRedactions,
  } = useExport()
  const { runOcr } = useOcr()
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
        src={asset('/brand/logo-horizontal.jpg')}
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
            title="Find (Ctrl+F)"
            active={ui.searchOpen}
            onClick={() => setSearch(!ui.searchOpen)}
          >
            <IconSearch />
          </ChromeButton>

          <div className="hidden items-center min-[880px]:flex">
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
              title="Night mode"
              active={ui.nightMode}
              onClick={toggleNight}
            >
              <IconMoon />
            </ChromeButton>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="View"
                className="grid h-8 w-8 place-items-center rounded-md text-chrome-muted hover:bg-white/8 hover:text-chrome-text min-[880px]:hidden"
              >
                <IconChevronDown />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-44 rounded-lg border border-chrome-line bg-ink-2 p-1 text-sm text-chrome-text shadow-2xl"
              >
                {(
                  [
                    ['showThumbnails', 'Pages', () => togglePanel('showThumbnails')],
                    ['showOutline', 'Outline', () => togglePanel('showOutline')],
                    [
                      'showProperties',
                      'Properties',
                      () => togglePanel('showProperties'),
                    ],
                    ['nightMode', 'Night mode', toggleNight],
                  ] as const
                ).map(([key, label, fn]) => (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={fn}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    {label}
                    {ui[key as keyof typeof ui] ? (
                      <span className="text-accent">●</span>
                    ) : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {doc && !doc.textLayerReady && (
            <ChromeButton
              title={
                ui.ocr
                  ? `OCR — page ${ui.ocr.page}/${ui.ocr.total}`
                  : 'Make searchable (OCR this scanned document)'
              }
              active={!!ui.ocr}
              onClick={() => !ui.ocr && runOcr()}
            >
              {ui.ocr ? (
                <span className="text-[10px] font-semibold tabular-nums">
                  {Math.round(
                    ((ui.ocr.page - 1 + ui.ocr.progress) / ui.ocr.total) * 100,
                  )}
                  %
                </span>
              ) : (
                <IconOcr />
              )}
            </ChromeButton>
          )}
          <div className="mx-1 h-5 w-px bg-chrome-line" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                disabled={exporting}
                className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60"
                title="Export PDF"
              >
                <IconDownload width={15} height={15} />
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-64 rounded-lg border border-chrome-line bg-ink-2 p-1 text-sm text-chrome-text shadow-2xl"
              >
                <DropdownMenu.Item
                  onSelect={() => runExport({ mode: 'flatten' })}
                  className="cursor-pointer rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-white/8"
                >
                  <div className="font-medium">Flattened PDF</div>
                  <div className="text-xs text-chrome-muted">
                    Markup baked into the page, forms flattened.
                  </div>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => runExport({ mode: 'editable' })}
                  className="cursor-pointer rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-white/8"
                >
                  <div className="font-medium">Redline PDF (re-editable)</div>
                  <div className="text-xs text-chrome-muted">
                    Looks flattened everywhere, but reopens in Redline with
                    every markup still editable.
                  </div>
                </DropdownMenu.Item>
                {hasRedactions && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-chrome-line" />
                    <DropdownMenu.Item
                      onSelect={() => runRedacted()}
                      className="cursor-pointer rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-white/8"
                    >
                      <div className="font-medium text-accent">
                        Apply redactions &amp; export
                      </div>
                      <div className="text-xs text-chrome-muted">
                        Redacted pages are flattened to images — content under
                        the marks is permanently removed.
                      </div>
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
