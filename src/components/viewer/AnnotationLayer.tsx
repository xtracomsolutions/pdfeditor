import { useEffect, useRef, useState } from 'react'
import { clone, useApp } from '../../state/store'
import type {
  Annotation,
  DocPage,
  ImageAnnotation,
  InkAnnotation,
  Point,
  ShapeAnnotation,
  TextBoxAnnotation,
} from '../../state/types'
import {
  pageTransform,
  pdfToScreen,
  screenToPdf,
  renderedSize,
} from '../../lib/pdf/geometry'
import {
  isDragTool,
  makeImageAnn,
  makeInk,
  makeShape,
  makeStamp,
  makeTextBox,
} from '../../lib/annotations/factory'
import { AnnotationView } from './AnnotationView'

interface Props {
  docId: string
  page: DocPage
  scale: number
  annotations: Annotation[]
}

type Draft =
  | { kind: 'ink'; points: number[] }
  | { kind: 'shape'; tool: ShapeAnnotation['kind'] | 'redact'; a: Point; b: Point }
  | null

export function AnnotationLayer({ page, scale, annotations }: Props) {
  const tool = useApp((s) => s.ui.activeTool)
  const opts = useApp((s) => s.ui.tool)
  const placement = useApp((s) => s.ui.placement)
  const setPlacement = useApp((s) => s.setPlacement)
  const selectedIds = useApp((s) => s.ui.selectedIds)
  const addAnnotation = useApp((s) => s.addAnnotation)
  const updateAnnotation = useApp((s) => s.updateAnnotation)
  const commit = useApp((s) => s.commit)
  const select = useApp((s) => s.select)
  const setTool = useApp((s) => s.setTool)

  const t = pageTransform(page, scale)
  const size = renderedSize(t)
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Draft>(null)
  const dragState = useRef<{
    id: string
    mode: 'move' | 'resize'
    startPdf: Point
    orig: Annotation
    committed: boolean
  } | null>(null)

  const isPlace =
    !!placement &&
    (tool === 'signature' || tool === 'image' || tool === 'stamp')
  const isDraw =
    tool === 'ink' ||
    isDragTool(tool) ||
    tool === 'textbox' ||
    tool === 'note' ||
    isPlace
  const localPoint = (e: React.PointerEvent): Point => {
    const box = ref.current!.getBoundingClientRect()
    return screenToPdf(t, e.clientX - box.left, e.clientY - box.top)
  }

  // ---- drawing new annotations ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isDraw) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = localPoint(e)
    if (isPlace && placement) {
      if (placement.kind === 'stamp') {
        const w = 120
        const h = 40
        addAnnotation(
          makeStamp(
            page.id,
            { x: p.x - w / 2, y: p.y - h / 2, w, h },
            placement.label ?? 'APPROVED',
            placement.stampStyle ?? 'approved',
            placement.color ?? opts.stroke,
          ),
        )
      } else if (placement.assetId) {
        const w = placement.kind === 'signature' ? 160 : 200
        const aspect = placement.aspect || 3
        const h = w / aspect
        addAnnotation(
          makeImageAnn(
            page.id,
            placement.kind,
            { x: p.x - w / 2, y: p.y - h / 2, w, h },
            placement.assetId,
          ),
        )
      }
      setPlacement(null)
      setTool('select')
      return
    }
    if (tool === 'ink') setDraft({ kind: 'ink', points: [p.x, p.y] })
    else if (tool === 'textbox' || tool === 'note') {
      const w = tool === 'note' ? 24 : 160
      const h = tool === 'note' ? 24 : 40
      const ann = makeTextBox(
        page.id,
        { x: p.x, y: p.y, w, h },
        opts,
        tool === 'note' ? 'note' : 'textbox',
      )
      addAnnotation(ann)
      setTool('select')
    } else {
      setDraft({
        kind: 'shape',
        tool: tool as ShapeAnnotation['kind'] | 'redact',
        a: p,
        b: p,
      })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (draft?.kind === 'ink') {
      const p = localPoint(e)
      setDraft({ kind: 'ink', points: [...draft.points, p.x, p.y] })
    } else if (draft?.kind === 'shape') {
      setDraft({ ...draft, b: localPoint(e) })
    }
  }

  const onPointerUp = () => {
    if (draft?.kind === 'ink' && draft.points.length >= 4) {
      addAnnotation(makeInk(page.id, [draft.points], opts))
    } else if (draft?.kind === 'shape') {
      const { a, b, tool: dt } = draft
      if (Math.hypot(a.x - b.x, a.y - b.y) > 3) {
        if (dt === 'redact') {
          addAnnotation({
            ...makeShape(page.id, 'rectangle', a, b, opts),
            kind: 'redaction',
            color: '#000000',
          } as Annotation)
        } else {
          addAnnotation(makeShape(page.id, dt, a, b, opts))
        }
      }
    }
    setDraft(null)
  }

  // ---- select / move / resize existing ----
  const beginDrag = (
    e: React.PointerEvent,
    ann: Annotation,
    mode: 'move' | 'resize',
  ) => {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    select([ann.id])
    dragState.current = {
      id: ann.id,
      mode,
      startPdf: localPoint(e),
      orig: clone(ann),
      committed: false,
    }
  }

  const onLayerPointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current
    if (!ds) return onPointerMove(e)
    if (!ds.committed) {
      commit()
      ds.committed = true
    }
    const p = localPoint(e)
    const dx = p.x - ds.startPdf.x
    const dy = p.y - ds.startPdf.y
    const o = ds.orig
    if (ds.mode === 'move') {
      const patch: Partial<Annotation> = {
        rect: { ...o.rect, x: o.rect.x + dx, y: o.rect.y + dy },
      }
      if (o.kind === 'ink')
        (patch as Partial<InkAnnotation>).strokes = (
          o as InkAnnotation
        ).strokes.map((st) => st.map((v, i) => (i % 2 ? v + dy : v + dx)))
      if ((o.kind === 'line' || o.kind === 'arrow') && 'start' in o) {
        const s = o as ShapeAnnotation
        ;(patch as Partial<ShapeAnnotation>).start = {
          x: s.start!.x + dx,
          y: s.start!.y + dy,
        }
        ;(patch as Partial<ShapeAnnotation>).end = {
          x: s.end!.x + dx,
          y: s.end!.y + dy,
        }
      }
      updateAnnotation(ds.id, patch)
    } else {
      updateAnnotation(ds.id, {
        rect: {
          x: o.rect.x,
          y: o.rect.y,
          w: Math.max(6, o.rect.w + dx),
          h: Math.max(6, o.rect.h + dy),
        },
      })
    }
  }

  const onLayerPointerUp = () => {
    if (dragState.current) {
      dragState.current = null
    } else onPointerUp()
  }

  const cursor =
    tool === 'ink'
      ? 'crosshair'
      : isDragTool(tool)
        ? 'crosshair'
        : tool === 'textbox' || tool === 'note'
          ? 'text'
          : 'default'

  // capture layer active only for drawing tools; otherwise pointer events pass
  // through to the text layer (for selection-based markup) and page.
  const capture = isDraw || !!dragState.current

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-[3]"
      style={{
        width: size.width,
        height: size.height,
        pointerEvents: capture ? 'auto' : 'none',
        cursor,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onLayerPointerMove}
      onPointerUp={onLayerPointerUp}
      onClick={(e) => {
        if (tool === 'select' && e.target === ref.current) select([])
      }}
    >
      <svg
        className="absolute inset-0 overflow-visible"
        width={size.width}
        height={size.height}
        style={{ pointerEvents: 'none' }}
      >
        {annotations.map((a) => (
          <AnnotationView
            key={a.id}
            ann={a}
            t={t}
            selected={selectedIds.includes(a.id)}
            selectable={tool === 'select'}
            onSelect={() => select([a.id])}
            onBeginMove={(e) => beginDrag(e, a, 'move')}
            onBeginResize={(e) => beginDrag(e, a, 'resize')}
            onChange={(patch) => updateAnnotation(a.id, patch)}
          />
        ))}
        {draft?.kind === 'ink' && (
          <polyline
            points={strokeToScreenPoints(draft.points, t)}
            fill="none"
            stroke={opts.stroke}
            strokeWidth={opts.strokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opts.opacity}
          />
        )}
        {draft?.kind === 'shape' && <DraftShape draft={draft} t={t} opts={opts} />}
      </svg>

      {/* HTML annotations (text boxes, notes, images) render above the svg */}
      {annotations
        .filter((a) => a.kind === 'textbox' || a.kind === 'note')
        .map((a) => (
          <TextBoxView
            key={a.id}
            ann={a as TextBoxAnnotation}
            t={t}
            selected={selectedIds.includes(a.id)}
            selectTool={tool === 'select'}
            onSelect={() => select([a.id])}
            onBeginMove={(e) => beginDrag(e, a, 'move')}
            onChange={(patch) => updateAnnotation(a.id, patch)}
          />
        ))}
      {annotations
        .filter((a) => a.kind === 'image' || a.kind === 'signature')
        .map((a) => (
          <ImageView
            key={a.id}
            ann={a as ImageAnnotation}
            t={t}
            selected={selectedIds.includes(a.id)}
            selectTool={tool === 'select'}
            onSelect={() => select([a.id])}
            onBeginMove={(e) => beginDrag(e, a, 'move')}
            onBeginResize={(e) => beginDrag(e, a, 'resize')}
          />
        ))}
    </div>
  )
}

function strokeToScreenPoints(flat: number[], t: ReturnType<typeof pageTransform>) {
  const out: string[] = []
  for (let i = 0; i < flat.length; i += 2) {
    const p = pdfToScreen(t, flat[i], flat[i + 1])
    out.push(`${p.x},${p.y}`)
  }
  return out.join(' ')
}

function DraftShape({
  draft,
  t,
  opts,
}: {
  draft: { tool: string; a: Point; b: Point }
  t: ReturnType<typeof pageTransform>
  opts: { stroke: string; strokeWidth: number; fill: string; opacity: number }
}) {
  const a = pdfToScreen(t, draft.a.x, draft.a.y)
  const b = pdfToScreen(t, draft.b.x, draft.b.y)
  const sw = opts.strokeWidth * t.scale
  const common = {
    stroke: draft.tool === 'redact' ? '#000' : opts.stroke,
    strokeWidth: sw,
    fill: draft.tool === 'redact' ? '#000' : opts.fill,
    opacity: draft.tool === 'redact' ? 0.85 : opts.opacity,
  }
  if (draft.tool === 'line' || draft.tool === 'arrow')
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(a.x - b.x)
  const h = Math.abs(a.y - b.y)
  if (draft.tool === 'ellipse')
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
  return <rect x={x} y={y} width={w} height={h} {...common} />
}

function TextBoxView({
  ann,
  t,
  selected,
  selectTool,
  onSelect,
  onBeginMove,
  onChange,
}: {
  ann: TextBoxAnnotation
  t: ReturnType<typeof pageTransform>
  selected: boolean
  selectTool: boolean
  onSelect: () => void
  onBeginMove: (e: React.PointerEvent) => void
  onChange: (patch: Partial<TextBoxAnnotation>) => void
}) {
  const p = pdfToScreen(t, ann.rect.x, ann.rect.y)
  const isNote = ann.kind === 'note'
  const [editing, setEditing] = useState(ann.text === '')
  return (
    <div
      className="absolute"
      style={{
        left: p.x,
        top: p.y,
        width: ann.rect.w * t.scale,
        minHeight: ann.rect.h * t.scale,
        pointerEvents: selectTool || editing ? 'auto' : 'none',
        outline: selected ? '1.5px solid var(--color-accent)' : 'none',
        background: isNote ? '#ffe89e' : ann.background,
        border: isNote ? 'none' : `1px solid ${ann.borderColor}`,
        borderRadius: isNote ? 4 : 2,
        boxShadow: isNote ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
      }}
      onPointerDown={(e) => {
        if (!editing && selectTool) onBeginMove(e)
      }}
      onDoubleClick={() => setEditing(true)}
      onClick={onSelect}
    >
      <textarea
        value={ann.text}
        placeholder={isNote ? 'Note…' : 'Text'}
        readOnly={!editing}
        onChange={(e) => onChange({ text: e.target.value })}
        onBlur={() => setEditing(false)}
        autoFocus={editing}
        className="h-full w-full resize-none bg-transparent p-1 outline-none"
        style={{
          fontSize: ann.fontSize * t.scale,
          fontFamily: ann.fontFamily,
          color: ann.color,
          lineHeight: 1.2,
        }}
      />
    </div>
  )
}

function ImageView({
  ann,
  t,
  selected,
  selectTool,
  onSelect,
  onBeginMove,
  onBeginResize,
}: {
  ann: ImageAnnotation
  t: ReturnType<typeof pageTransform>
  selected: boolean
  selectTool: boolean
  onSelect: () => void
  onBeginMove: (e: React.PointerEvent) => void
  onBeginResize: (e: React.PointerEvent) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    let alive = true
    import('../../lib/storage/db').then(async ({ getAsset }) => {
      const rec = await getAsset(ann.assetId)
      if (rec && alive) {
        u = URL.createObjectURL(rec.blob)
        setUrl(u)
      }
    })
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [ann.assetId])

  const p = pdfToScreen(t, ann.rect.x, ann.rect.y)
  return (
    <div
      className="absolute"
      style={{
        left: p.x,
        top: p.y,
        width: ann.rect.w * t.scale,
        height: ann.rect.h * t.scale,
        pointerEvents: selectTool ? 'auto' : 'none',
        outline: selected ? '1.5px solid var(--color-accent)' : 'none',
        cursor: selectTool ? 'move' : 'default',
      }}
      onPointerDown={(e) => selectTool && onBeginMove(e)}
      onClick={onSelect}
    >
      {url && (
        <img
          src={url}
          alt={ann.kind}
          className="h-full w-full object-contain"
          draggable={false}
        />
      )}
      {selected && selectTool && (
        <div
          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize bg-accent"
          onPointerDown={(e) => {
            e.stopPropagation()
            onBeginResize(e)
          }}
        />
      )}
    </div>
  )
}
