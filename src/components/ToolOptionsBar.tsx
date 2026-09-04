import { useApp } from '../state/store'
import { isDragTool, isTextMarkupTool } from '../lib/annotations/factory'

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

export function ToolOptionsBar() {
  const tool = useApp((s) => s.ui.activeTool)
  const o = useApp((s) => s.ui.tool)
  const set = useApp((s) => s.setToolOption)

  const showColor =
    tool === 'ink' ||
    isDragTool(tool) ||
    isTextMarkupTool(tool) ||
    tool === 'textbox' ||
    tool === 'note' ||
    tool === 'stamp'
  const showStroke = tool === 'ink' || isDragTool(tool)
  const showFill = tool === 'rectangle' || tool === 'ellipse'
  const showFont = tool === 'textbox' || tool === 'note'

  if (!showColor && !showStroke && !showFont) return null

  const colorKey = isTextMarkupTool(tool) && tool === 'highlight' ? 'highlightColor' : 'stroke'
  const current = o[colorKey as 'stroke' | 'highlightColor']

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-chrome-line bg-ink-2 px-3 text-xs text-chrome-muted">
      {showColor && (
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wide">Color</span>
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => set(colorKey as 'stroke', c)}
              className={`h-5 w-5 rounded-full border ${
                current === c
                  ? 'border-accent ring-2 ring-accent/40'
                  : 'border-black/30'
              }`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      )}

      {showStroke && (
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide">Width</span>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={o.strokeWidth}
            onChange={(e) => set('strokeWidth', Number(e.target.value))}
            className="w-24 accent-accent"
          />
          <span className="w-4 text-chrome-text">{o.strokeWidth}</span>
        </label>
      )}

      {showFill && (
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide">Fill</span>
          <button
            onClick={() =>
              set('fill', o.fill === 'transparent' ? o.stroke : 'transparent')
            }
            className="rounded border border-chrome-line px-2 py-0.5 text-chrome-text"
          >
            {o.fill === 'transparent' ? 'None' : 'Solid'}
          </button>
        </label>
      )}

      {(showStroke || isTextMarkupTool(tool)) && (
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide">Opacity</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={o.opacity}
            onChange={(e) => set('opacity', Number(e.target.value))}
            className="w-20 accent-accent"
          />
        </label>
      )}

      {showFont && (
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide">Size</span>
          <input
            type="range"
            min={8}
            max={48}
            step={1}
            value={o.fontSize}
            onChange={(e) => set('fontSize', Number(e.target.value))}
            className="w-24 accent-accent"
          />
          <span className="w-5 text-chrome-text">{o.fontSize}</span>
        </label>
      )}
    </div>
  )
}
