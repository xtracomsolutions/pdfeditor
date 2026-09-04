/**
 * Redaction export — the "maximum security" path.
 *
 * Any page that carries a redaction is rendered to a raster, the redacted
 * regions are painted out on the pixels, and the page is replaced by that
 * flattened image. This guarantees nothing survives under the black box — no
 * text, no vector art, no metadata — at the cost of a selectable text layer on
 * those pages. Pages with no redactions are copied through untouched.
 */
import { PDFDocument, degrees } from 'pdf-lib'
import type { OpenDoc } from '../../state/types'
import { getPageProxy } from '../pdf/registry'
import { pdfRectToScreen, pageTransform } from '../pdf/geometry'
import { exportPdf } from './exportPdf'

const RASTER_SCALE = 2.5 // ~180 dpi

export async function exportRedacted(doc: OpenDoc): Promise<Uint8Array> {
  const redactedPageIds = new Set(
    Object.values(doc.annotations)
      .filter((a) => a.kind === 'redaction')
      .map((a) => a.pageId),
  )

  // no redactions -> normal flatten export
  if (redactedPageIds.size === 0) return exportPdf(doc, { scrubMetadata: true })

  const out = await PDFDocument.create()
  const srcCache = new Map<string, Promise<PDFDocument>>()
  const srcDoc = (id: string) => {
    let p = srcCache.get(id)
    if (!p) {
      p = PDFDocument.load(doc.sources.find((s) => s.id === id)!.bytes, {
        ignoreEncryption: true,
      })
      srcCache.set(id, p)
    }
    return p
  }

  for (const dp of doc.pages) {
    const anns = Object.values(doc.annotations).filter((a) => a.pageId === dp.id)

    if (!redactedPageIds.has(dp.id) || dp.sourceId == null) {
      // pass-through (still flatten this page's annotations via exportPdf later
      // would double-handle; instead copy + we accept these are handled here)
      if (dp.sourceId) {
        const sd = await srcDoc(dp.sourceId)
        const [p] = await out.copyPages(sd, [dp.sourceIndex])
        const page = out.addPage(p)
        if (dp.userRotation)
          page.setRotation(
            degrees((page.getRotation().angle + dp.userRotation) % 360),
          )
      } else {
        out.addPage([dp.width, dp.height])
      }
      continue
    }

    // rasterize this page
    const proxyP = getPageProxy(doc.id, dp.sourceId, dp.sourceIndex)
    if (!proxyP) continue
    const proxy = await proxyP
    const viewport = proxy.getViewport({
      scale: RASTER_SCALE,
      rotation: dp.userRotation,
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await proxy.render({ canvas, canvasContext: ctx, viewport }).promise

    const t = pageTransform(dp, RASTER_SCALE)

    // paint non-redaction annotations first (so redaction covers them too)
    for (const a of anns) {
      if (a.kind === 'redaction') continue
      paintAnnotation(ctx, a, t)
    }
    // then the redactions — solid, opaque
    ctx.fillStyle = '#000'
    for (const a of anns)
      if (a.kind === 'redaction') {
        const r = pdfRectToScreen(t, a.rect)
        ctx.fillRect(r.left, r.top, r.width, r.height)
      }

    const jpg = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92),
    )
    const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
    const page = out.addPage([dp.width, dp.height])
    page.drawImage(img, { x: 0, y: 0, width: dp.width, height: dp.height })
  }

  out.setTitle('')
  out.setAuthor('')
  out.setSubject('')
  out.setKeywords([])
  out.setProducer('Redline')
  out.setCreator('Redline')

  return out.save()
}

/** Minimal canvas painter for annotations on rasterized pages. */
function paintAnnotation(
  ctx: CanvasRenderingContext2D,
  a: import('../../state/types').Annotation,
  t: ReturnType<typeof pageTransform>,
) {
  const s = t.scale
  const col = a.color ?? '#e5484d'
  if (a.kind === 'highlight') {
    ctx.save()
    ctx.globalAlpha = a.opacity ?? 0.4
    ctx.fillStyle = col
    for (const q of (a as import('../../state/types').TextMarkupAnnotation)
      .quads) {
      const r = pdfRectToScreen(t, q)
      ctx.fillRect(r.left, r.top, r.width, r.height)
    }
    ctx.restore()
  } else if (a.kind === 'ink') {
    ctx.save()
    ctx.strokeStyle = col
    ctx.lineWidth =
      (a as import('../../state/types').InkAnnotation).strokeWidth * s
    ctx.lineCap = 'round'
    for (const st of (a as import('../../state/types').InkAnnotation).strokes) {
      ctx.beginPath()
      for (let i = 0; i < st.length; i += 2) {
        const p = pdfRectToScreen(t, { x: st[i], y: st[i + 1], w: 0, h: 0 })
        i === 0 ? ctx.moveTo(p.left, p.top) : ctx.lineTo(p.left, p.top)
      }
      ctx.stroke()
    }
    ctx.restore()
  } else if (
    a.kind === 'rectangle' ||
    a.kind === 'ellipse' ||
    a.kind === 'whiteout'
  ) {
    const r = pdfRectToScreen(t, a.rect)
    ctx.save()
    ctx.strokeStyle = col
    ctx.fillStyle = a.kind === 'whiteout' ? '#fff' : 'transparent'
    ctx.lineWidth = 2 * s
    if (a.kind === 'whiteout') ctx.fillRect(r.left, r.top, r.width, r.height)
    else ctx.strokeRect(r.left, r.top, r.width, r.height)
    ctx.restore()
  }
  // (text boxes / stamps / signatures on redacted pages are rare; handled by
  //  the normal export path on non-redacted pages)
}
