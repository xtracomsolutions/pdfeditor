import type { PointerEvent as RPointerEvent } from 'react'
import type {
  Annotation,
  InkAnnotation,
  RedactionAnnotation,
  ShapeAnnotation,
  StampAnnotation,
  TextMarkupAnnotation,
} from '../../state/types'
import {
  pdfRectToScreen,
  pdfToScreen,
  type PageTransform,
} from '../../lib/pdf/geometry'

interface Props {
  ann: Annotation
  t: PageTransform
  selected: boolean
  selectable: boolean
  onSelect: () => void
  onBeginMove: (e: RPointerEvent) => void
  onBeginResize: (e: RPointerEvent) => void
  onChange: (patch: Partial<Annotation>) => void
}

export function AnnotationView({
  ann,
  t,
  selected,
  selectable,
  onSelect,
  onBeginMove,
  onBeginResize,
}: Props) {
  const s = t.scale
  const hit = (e: RPointerEvent) => {
    if (!selectable) return
    onBeginMove(e)
  }
  const box = pdfRectToScreen(t, ann.rect)
  const groupProps = {
    style: { pointerEvents: selectable ? ('visiblePainted' as const) : ('none' as const), cursor: selectable ? 'move' : 'default' },
    onPointerDown: hit,
    onClick: onSelect,
  }

  let body: React.ReactNode = null

  if (ann.kind === 'highlight' || ann.kind === 'underline' || ann.kind === 'strikeout') {
    const m = ann as TextMarkupAnnotation
    body = (
      <g {...groupProps}>
        {m.quads.map((q, i) => {
          const r = pdfRectToScreen(t, q)
          if (m.kind === 'highlight')
            return (
              <rect
                key={i}
                x={r.left}
                y={r.top}
                width={r.width}
                height={r.height}
                fill={m.color}
                opacity={m.opacity ?? 0.4}
              />
            )
          const y = m.kind === 'underline' ? r.top + r.height - 1 : r.top + r.height / 2
          return (
            <line
              key={i}
              x1={r.left}
              y1={y}
              x2={r.left + r.width}
              y2={y}
              stroke={m.color}
              strokeWidth={Math.max(1, 1.4 * s)}
            />
          )
        })}
      </g>
    )
  } else if (ann.kind === 'ink') {
    const k = ann as InkAnnotation
    body = (
      <g {...groupProps}>
        {k.strokes.map((st, i) => {
          const pts: string[] = []
          for (let j = 0; j < st.length; j += 2) {
            const p = pdfToScreen(t, st[j], st[j + 1])
            pts.push(`${p.x},${p.y}`)
          }
          return (
            <polyline
              key={i}
              points={pts.join(' ')}
              fill="none"
              stroke={k.color}
              strokeWidth={k.strokeWidth * s}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={k.opacity ?? 1}
            />
          )
        })}
      </g>
    )
  } else if (ann.kind === 'redaction' || ann.kind === 'whiteout') {
    const r = ann as RedactionAnnotation
    body = (
      <g {...groupProps}>
        <rect
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          fill={r.kind === 'whiteout' ? '#fff' : '#000'}
          stroke={selected ? 'var(--color-accent)' : r.kind === 'whiteout' ? '#bbb' : '#000'}
          strokeDasharray={r.kind === 'whiteout' ? '4 3' : undefined}
        />
      </g>
    )
  } else if (ann.kind === 'stamp') {
    const st = ann as StampAnnotation
    body = (
      <g {...groupProps}>
        <rect
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          rx={4}
          fill="none"
          stroke={ann.color ?? '#e5484d'}
          strokeWidth={2 * s}
        />
        <text
          x={box.left + box.width / 2}
          y={box.top + box.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ann.color ?? '#e5484d'}
          fontSize={Math.min(box.height * 0.5, 16 * s)}
          fontFamily="Outfit, sans-serif"
          fontWeight="700"
        >
          {st.label}
        </text>
      </g>
    )
  } else if (
    ann.kind === 'rectangle' ||
    ann.kind === 'ellipse' ||
    ann.kind === 'line' ||
    ann.kind === 'arrow'
  ) {
    const sh = ann as ShapeAnnotation
    const sw = sh.strokeWidth * s
    if (sh.kind === 'line' || sh.kind === 'arrow') {
      const a = pdfToScreen(t, sh.start!.x, sh.start!.y)
      const b = pdfToScreen(t, sh.end!.x, sh.end!.y)
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const head = 9 * s
      body = (
        <g {...groupProps}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={sh.color} strokeWidth={sw} strokeLinecap="round" opacity={sh.opacity ?? 1} />
          {sh.kind === 'arrow' && (
            <polygon
              points={`${b.x},${b.y} ${b.x - head * Math.cos(ang - 0.4)},${b.y - head * Math.sin(ang - 0.4)} ${b.x - head * Math.cos(ang + 0.4)},${b.y - head * Math.sin(ang + 0.4)}`}
              fill={sh.color}
            />
          )}
        </g>
      )
    } else if (sh.kind === 'ellipse') {
      body = (
        <g {...groupProps}>
          <ellipse
            cx={box.left + box.width / 2}
            cy={box.top + box.height / 2}
            rx={box.width / 2}
            ry={box.height / 2}
            stroke={sh.color}
            strokeWidth={sw}
            fill={sh.fill && sh.fill !== 'transparent' ? sh.fill : 'none'}
            opacity={sh.opacity ?? 1}
          />
        </g>
      )
    } else {
      body = (
        <g {...groupProps}>
          <rect
            x={box.left}
            y={box.top}
            width={box.width}
            height={box.height}
            stroke={sh.color}
            strokeWidth={sw}
            fill={sh.fill && sh.fill !== 'transparent' ? sh.fill : 'none'}
            opacity={sh.opacity ?? 1}
          />
        </g>
      )
    }
  }

  return (
    <>
      {body}
      {selected && selectable && ann.kind !== 'line' && ann.kind !== 'arrow' && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={box.left - 2}
            y={box.top - 2}
            width={box.width + 4}
            height={box.height + 4}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <rect
            x={box.left + box.width - 4}
            y={box.top + box.height - 4}
            width={9}
            height={9}
            fill="var(--color-accent)"
            style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
            onPointerDown={onBeginResize}
          />
        </g>
      )}
    </>
  )
}
