/**
 * Coordinate transforms between screen pixels and PDF points.
 *
 * Annotations are stored in **unrotated page space**, PDF points, top-left
 * origin, y down. The rendered page may be scaled and view-rotated; these
 * helpers convert in both directions so the model never has to care.
 */
import type { DocPage, Point, Rect } from '../../state/types'

export interface PageTransform {
  /** unrotated page size, PDF points */
  w: number
  h: number
  scale: number
  rotation: 0 | 90 | 180 | 270
}

export function pageTransform(page: DocPage, scale: number): PageTransform {
  return { w: page.width, h: page.height, scale, rotation: page.userRotation }
}

/** Rendered (on-screen) size of the page box in CSS pixels. */
export function renderedSize(t: PageTransform) {
  const swap = t.rotation % 180 !== 0
  return {
    width: (swap ? t.h : t.w) * t.scale,
    height: (swap ? t.w : t.h) * t.scale,
  }
}

/** Screen px within the page box -> PDF point in unrotated space. */
export function screenToPdf(t: PageTransform, sx: number, sy: number): Point {
  const { width, height } = renderedSize(t)
  const s = t.scale
  switch (t.rotation) {
    case 90:
      return { x: sy / s, y: (width - sx) / s }
    case 180:
      return { x: (width - sx) / s, y: (height - sy) / s }
    case 270:
      return { x: (height - sy) / s, y: sx / s }
    default:
      return { x: sx / s, y: sy / s }
  }
}

/** PDF point (unrotated) -> screen px within the page box. */
export function pdfToScreen(t: PageTransform, px: number, py: number): Point {
  const { width, height } = renderedSize(t)
  const s = t.scale
  switch (t.rotation) {
    case 90:
      return { x: width - py * s, y: px * s }
    case 180:
      return { x: width - px * s, y: height - py * s }
    case 270:
      return { x: py * s, y: height - px * s }
    default:
      return { x: px * s, y: py * s }
  }
}

/** Axis-aligned PDF rect -> screen rect (CSS left/top/width/height). */
export function pdfRectToScreen(t: PageTransform, r: Rect) {
  const a = pdfToScreen(t, r.x, r.y)
  const b = pdfToScreen(t, r.x + r.w, r.y + r.h)
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

/** DOMRect (viewport coords) -> PDF rect, given the page element's box. */
export function domRectToPdf(
  t: PageTransform,
  pageBox: DOMRect,
  r: DOMRect,
): Rect {
  const p1 = screenToPdf(t, r.left - pageBox.left, r.top - pageBox.top)
  const p2 = screenToPdf(t, r.right - pageBox.left, r.bottom - pageBox.top)
  return normalizeRect(p1, p2)
}

export function unionRects(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x0 = Math.min(...rects.map((r) => r.x))
  const y0 = Math.min(...rects.map((r) => r.y))
  const x1 = Math.max(...rects.map((r) => r.x + r.w))
  const y1 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
