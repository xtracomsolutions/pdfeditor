import { useApp } from '../state/store'
import type { Annotation, OpenDoc } from '../state/types'
import { IconTrash } from './icons'

const SWATCHES = [
  '#e5484d',
  '#f5a623',
  '#ffd23f',
  '#30a46c',
  '#4bafd6',
  '#3b5bdb',
  '#8e4ec6',
  '#16191d',
  '#ffffff',
]

const HAS_STROKE = new Set([
  'ink',
  'rectangle',
  'ellipse',
  'line',
  'arrow',
])
const HAS_FILL = new Set(['rectangle', 'ellipse'])

export function PropertiesPanel({ doc }: { doc: OpenDoc }) {
  const selectedIds = useApp((s) => s.ui.selectedIds)
  const updateAnnotation = useApp((s) => s.updateAnnotation)
  const removeAnnotations = useApp((s) => s.removeAnnotations)
  const commit = useApp((s) => s.commit)

  const sel = selectedIds
    .map((id) => doc.annotations[id])
    .filter(Boolean) as Annotation[]

  const patchAll = (patch: Partial<Annotation>, snapshot = true) => {
    if (snapshot) commit()
    for (const a of sel) updateAnnotation(a.id, patch)
  }

  const kinds = new Set(sel.map((a) => a.kind))
  const showStroke = sel.some((a) => HAS_STROKE.has(a.kind))
  const showFill = sel.some((a) => HAS_FILL.has(a.kind))
  const showText = sel.some((a) => a.kind === 'textbox' || a.kind === 'note')
  const first = sel[0]

  return (
    <div className="chrome-scroll h-full w-64 shrink-0 overflow-y-auto border-l border-chrome-line bg-ink px-3 py-3 text-sm">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
        {sel.length ? `Selection · ${[...kinds].join(', ')}` : 'Document'}
      </div>

      {sel.length === 0 ? (
        <dl className="space-y-1.5 text-chrome-muted">
          <Row k="Pages" v={String(doc.pages.length)} />
          <Row k="Form fields" v={doc.hasAcroForm ? 'Yes' : 'No'} />
          <Row
            k="Text layer"
            v={doc.textLayerReady ? 'Present' : 'Scanned / none'}
          />
          <Row k="Sources" v={String(doc.sources.length)} />
          <Row
            k="Annotations"
            v={String(Object.keys(doc.annotations).length)}
          />
        </dl>
      ) : (
        <div className="space-y-4">
          {(showStroke ||
            showText ||
            sel.some((a) => a.kind.startsWith('highlight'))) && (
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-chrome-muted">
                Colour
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchAll({ color: c })}
                    className={`h-6 w-6 rounded-full border ${
                      first?.color === c
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-black/30'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {showStroke && (
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-chrome-muted">
                <span>Stroke width</span>
                <span className="text-chrome-text">
                  {(first as { strokeWidth?: number })?.strokeWidth ?? 2}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                defaultValue={
                  (first as { strokeWidth?: number })?.strokeWidth ?? 2
                }
                onPointerDown={() => commit()}
                onChange={(e) =>
                  patchAll(
                    { strokeWidth: Number(e.target.value) } as Partial<Annotation>,
                    false,
                  )
                }
                className="w-full accent-accent"
              />
            </label>
          )}

          {showFill && (
            <button
              onClick={() =>
                patchAll({
                  fill:
                    (first as { fill?: string })?.fill &&
                    (first as { fill?: string }).fill !== 'transparent'
                      ? 'transparent'
                      : (first?.color ?? '#e5484d'),
                } as Partial<Annotation>)
              }
              className="rounded-md border border-chrome-line px-2.5 py-1 text-xs text-chrome-text hover:border-accent"
            >
              {(first as { fill?: string })?.fill &&
              (first as { fill?: string }).fill !== 'transparent'
                ? 'Fill: solid'
                : 'Fill: none'}
            </button>
          )}

          <label className="block">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-chrome-muted">
              Opacity
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              defaultValue={first?.opacity ?? 1}
              onPointerDown={() => commit()}
              onChange={(e) =>
                patchAll({ opacity: Number(e.target.value) }, false)
              }
              className="w-full accent-accent"
            />
          </label>

          {showText && (
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-chrome-muted">
                <span>Font size</span>
                <span className="text-chrome-text">
                  {(first as { fontSize?: number })?.fontSize ?? 14}
                </span>
              </div>
              <input
                type="range"
                min={6}
                max={48}
                defaultValue={(first as { fontSize?: number })?.fontSize ?? 14}
                onPointerDown={() => commit()}
                onChange={(e) =>
                  patchAll(
                    { fontSize: Number(e.target.value) } as Partial<Annotation>,
                    false,
                  )
                }
                className="w-full accent-accent"
              />
            </label>
          )}

          <button
            onClick={() => removeAnnotations(selectedIds)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
          >
            <IconTrash width={14} height={14} />
            Delete {sel.length > 1 ? `${sel.length} items` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="text-chrome-text">{v}</dd>
    </div>
  )
}
