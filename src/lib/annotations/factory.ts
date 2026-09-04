import { nanoid } from '../id'
import type {
  Annotation,
  InkAnnotation,
  Point,
  Rect,
  ShapeAnnotation,
  TextBoxAnnotation,
  TextMarkupAnnotation,
} from '../../state/types'
import type { ToolOptions } from '../../state/store'
import { unionRects } from '../pdf/geometry'

const now = () => Date.now()
const base = (pageId: string) => ({
  id: nanoid(),
  pageId,
  createdAt: now(),
  updatedAt: now(),
})

export function makeInk(
  pageId: string,
  strokes: number[][],
  o: ToolOptions,
): InkAnnotation {
  const pts: Rect[] = []
  for (const st of strokes)
    for (let i = 0; i < st.length; i += 2)
      pts.push({ x: st[i], y: st[i + 1], w: 0, h: 0 })
  return {
    ...base(pageId),
    kind: 'ink',
    strokes,
    strokeWidth: o.strokeWidth,
    color: o.stroke,
    opacity: o.opacity,
    rect: unionRects(pts),
  }
}

export function makeShape(
  pageId: string,
  kind: ShapeAnnotation['kind'],
  a: Point,
  b: Point,
  o: ToolOptions,
): ShapeAnnotation {
  const rect: Rect = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
  return {
    ...base(pageId),
    kind,
    rect,
    strokeWidth: o.strokeWidth,
    color: o.stroke,
    fill: o.fill,
    opacity: o.opacity,
    start: kind === 'line' || kind === 'arrow' ? a : undefined,
    end: kind === 'line' || kind === 'arrow' ? b : undefined,
  }
}

export function makeTextMarkup(
  pageId: string,
  kind: TextMarkupAnnotation['kind'],
  quads: Rect[],
  o: ToolOptions,
): TextMarkupAnnotation {
  return {
    ...base(pageId),
    kind,
    quads,
    rect: unionRects(quads),
    color: kind === 'highlight' ? o.highlightColor : o.stroke,
    opacity: kind === 'highlight' ? 0.4 : 1,
  }
}

export function makeTextBox(
  pageId: string,
  rect: Rect,
  o: ToolOptions,
  kind: 'textbox' | 'note' = 'textbox',
): TextBoxAnnotation {
  return {
    ...base(pageId),
    kind,
    rect,
    text: '',
    fontSize: o.fontSize,
    fontFamily: o.fontFamily,
    align: 'left',
    color: kind === 'note' ? '#1e2429' : o.stroke,
    background: kind === 'note' ? '#ffe89e' : 'transparent',
    borderColor: kind === 'note' ? 'transparent' : o.stroke,
    opacity: 1,
  }
}

export function isTextMarkupTool(t: string) {
  return t === 'highlight' || t === 'underline' || t === 'strikeout'
}

export function isDragTool(t: string) {
  return (
    t === 'rectangle' ||
    t === 'ellipse' ||
    t === 'line' ||
    t === 'arrow' ||
    t === 'redact'
  )
}

export type { Annotation }
