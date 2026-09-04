/**
 * Turn a DOM text selection over a pdf.js text layer into tight per-line quads.
 *
 * The text layer wraps runs in `.markedContent` spans; calling
 * `range.getClientRects()` on a multi-span range picks up those full-width
 * wrapper boxes. So instead we walk the leaf text spans the range touches and
 * measure a clamped sub-range inside each one.
 */
import type { DocPage, Rect } from '../../state/types'
import { domRectToPdf, pageTransform } from './geometry'

export function selectionQuads(
  range: Range,
  textLayer: HTMLElement,
  page: DocPage,
  pageBox: DOMRect,
  scale: number,
): Rect[] {
  const t = pageTransform(page, scale)
  const leaves = Array.from(
    textLayer.querySelectorAll<HTMLElement>('span[role="presentation"]'),
  ).filter((s) => s.firstChild?.nodeType === Node.TEXT_NODE)

  const domRects: DOMRect[] = []
  for (const span of leaves) {
    if (!range.intersectsNode(span)) continue
    const text = span.firstChild as Text
    const sub = document.createRange()
    sub.selectNodeContents(text)
    // clamp to the selection
    if (
      range.startContainer === text ||
      span.contains(range.startContainer)
    )
      sub.setStart(range.startContainer, range.startOffset)
    if (range.endContainer === text || span.contains(range.endContainer))
      sub.setEnd(range.endContainer, range.endOffset)
    for (const r of Array.from(sub.getClientRects()))
      if (r.width > 0.5 && r.height > 0.5) domRects.push(r)
  }

  // merge rects on the same visual line
  const merged: DOMRect[] = []
  for (const r of domRects.sort((a, b) => a.top - b.top || a.left - b.left)) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.top - r.top) < 3 && Math.abs(last.height - r.height) < 4) {
      const left = Math.min(last.left, r.left)
      const right = Math.max(last.right, r.right)
      merged[merged.length - 1] = new DOMRect(
        left,
        Math.min(last.top, r.top),
        right - left,
        Math.max(last.height, r.height),
      )
    } else {
      merged.push(new DOMRect(r.left, r.top, r.width, r.height))
    }
  }

  return merged
    .map((r) => domRectToPdf(t, pageBox, r))
    .filter((q) => q.w > 0.5 && q.h > 0.5)
}
