/**
 * Export pipeline. Takes an OpenDoc (original bytes + page list + annotation
 * model) and produces a new PDF via pdf-lib.
 *
 * v1 path: **flatten** — every annotation is painted into page content and the
 * form is flattened. Editable export (real PDF annotations + embedded model)
 * comes later.
 *
 * Coordinate handling: the model is top-left origin, y-down, in unrotated page
 * space. pdf-lib draws bottom-left origin, y-up, also in unrotated content
 * space (page rotation is a separate display transform). So we only flip y:
 * `pdfY = pageHeight - modelY`.
 */
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type {
  Annotation,
  InkAnnotation,
  OpenDoc,
  ShapeAnnotation,
  StampAnnotation,
  TextBoxAnnotation,
  TextMarkupAnnotation,
} from '../../state/types'
import { getAsset } from '../storage/db'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export interface ExportOptions {
  /** 'flatten' bakes annotations into content; 'editable' keeps them live. */
  mode?: 'flatten' | 'editable'
  /** strip metadata (used by the redaction path). */
  scrubMetadata?: boolean
}

export async function exportPdf(
  doc: OpenDoc,
  opts: ExportOptions = {},
): Promise<Uint8Array> {
  const src = await PDFDocument.load(doc.bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const helv = await out.embedFont(StandardFonts.Helvetica)
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold)

  // rebuild page order from the model, carrying user rotation. Copy each page
  // on its own so duplicated source pages produce independent page objects.
  for (let i = 0; i < doc.pages.length; i++) {
    const dp = doc.pages[i]
    let page: PDFPage
    if (dp.sourceIndex >= 0) {
      const [p] = await out.copyPages(src, [dp.sourceIndex])
      page = out.addPage(p)
    } else {
      page = out.addPage([dp.width, dp.height])
    }

    if (dp.userRotation) {
      const base = page.getRotation().angle
      page.setRotation(degrees((base + dp.userRotation) % 360))
    }

    const anns = Object.values(doc.annotations).filter((a) => a.pageId === dp.id)
    for (const a of anns) drawAnnotation(page, a, { helv, helvBold, out })
  }

  if (opts.scrubMetadata || opts.mode !== 'editable') {
    out.setTitle('')
    out.setAuthor('')
    out.setSubject('')
    out.setKeywords([])
    out.setProducer('Redline')
    out.setCreator('Redline')
  }

  return out.save()
}

interface Ctx {
  helv: PDFFont
  helvBold: PDFFont
  out: PDFDocument
}

function drawAnnotation(page: PDFPage, a: Annotation, ctx: Ctx) {
  const H = page.getHeight()
  const flipY = (y: number) => H - y
  const color = a.color ? hexToRgb(a.color) : rgb(0.9, 0.1, 0.1)
  const opacity = a.opacity ?? 1

  switch (a.kind) {
    case 'highlight': {
      const m = a as TextMarkupAnnotation
      for (const q of m.quads)
        page.drawRectangle({
          x: q.x,
          y: flipY(q.y + q.h),
          width: q.w,
          height: q.h,
          color,
          opacity: 0.4,
        })
      break
    }
    case 'underline':
    case 'strikeout': {
      const m = a as TextMarkupAnnotation
      for (const q of m.quads) {
        const y = a.kind === 'underline' ? flipY(q.y + q.h) : flipY(q.y + q.h / 2)
        page.drawLine({
          start: { x: q.x, y },
          end: { x: q.x + q.w, y },
          thickness: 1.2,
          color,
        })
      }
      break
    }
    case 'ink': {
      const k = a as InkAnnotation
      for (const st of k.strokes)
        for (let i = 2; i < st.length; i += 2)
          page.drawLine({
            start: { x: st[i - 2], y: flipY(st[i - 1]) },
            end: { x: st[i], y: flipY(st[i + 1]) },
            thickness: k.strokeWidth,
            color,
            opacity,
          })
      break
    }
    case 'rectangle':
    case 'ellipse': {
      const s = a as ShapeAnnotation
      const common = {
        x: s.rect.x,
        y: flipY(s.rect.y + s.rect.h),
        width: s.rect.w,
        height: s.rect.h,
        borderColor: color,
        borderWidth: s.strokeWidth,
        color:
          s.fill && s.fill !== 'transparent' ? hexToRgb(s.fill) : undefined,
        opacity,
        borderOpacity: opacity,
      }
      if (a.kind === 'ellipse')
        page.drawEllipse({
          x: s.rect.x + s.rect.w / 2,
          y: flipY(s.rect.y + s.rect.h / 2),
          xScale: s.rect.w / 2,
          yScale: s.rect.h / 2,
          borderColor: color,
          borderWidth: s.strokeWidth,
          color:
            s.fill && s.fill !== 'transparent' ? hexToRgb(s.fill) : undefined,
          opacity,
          borderOpacity: opacity,
        })
      else page.drawRectangle(common)
      break
    }
    case 'line':
    case 'arrow': {
      const s = a as ShapeAnnotation
      if (!s.start || !s.end) break
      page.drawLine({
        start: { x: s.start.x, y: flipY(s.start.y) },
        end: { x: s.end.x, y: flipY(s.end.y) },
        thickness: s.strokeWidth,
        color,
        opacity,
      })
      if (a.kind === 'arrow') {
        const ang = Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x)
        const hl = 8 + s.strokeWidth
        const ax = s.end.x
        const ay = s.end.y
        page.drawLine({
          start: { x: ax, y: flipY(ay) },
          end: {
            x: ax - hl * Math.cos(ang - 0.4),
            y: flipY(ay - hl * Math.sin(ang - 0.4)),
          },
          thickness: s.strokeWidth,
          color,
        })
        page.drawLine({
          start: { x: ax, y: flipY(ay) },
          end: {
            x: ax - hl * Math.cos(ang + 0.4),
            y: flipY(ay - hl * Math.sin(ang + 0.4)),
          },
          thickness: s.strokeWidth,
          color,
        })
      }
      break
    }
    case 'textbox':
    case 'note': {
      const tb = a as TextBoxAnnotation
      if (a.kind === 'note') {
        page.drawRectangle({
          x: tb.rect.x,
          y: flipY(tb.rect.y + tb.rect.h),
          width: tb.rect.w,
          height: tb.rect.h,
          color: rgb(1, 0.91, 0.62),
        })
      }
      if (tb.text.trim()) {
        const font = ctx.helv
        const size = tb.fontSize
        const lines = wrapText(tb.text, font, size, tb.rect.w - 4)
        lines.forEach((ln, i) => {
          page.drawText(ln, {
            x: tb.rect.x + 2,
            y: flipY(tb.rect.y + size + i * size * 1.2),
            size,
            font,
            color: hexToRgb(tb.color ?? '#16191d'),
          })
        })
      }
      break
    }
    case 'stamp': {
      const st = a as StampAnnotation
      page.drawRectangle({
        x: st.rect.x,
        y: flipY(st.rect.y + st.rect.h),
        width: st.rect.w,
        height: st.rect.h,
        borderColor: color,
        borderWidth: 2,
      })
      page.drawText(st.label, {
        x: st.rect.x + 6,
        y: flipY(st.rect.y + st.rect.h / 2 + 6),
        size: Math.min(st.rect.h * 0.5, 16),
        font: ctx.helvBold,
        color,
      })
      break
    }
    case 'redaction':
    case 'whiteout': {
      page.drawRectangle({
        x: a.rect.x,
        y: flipY(a.rect.y + a.rect.h),
        width: a.rect.w,
        height: a.rect.h,
        color: a.kind === 'whiteout' ? rgb(1, 1, 1) : rgb(0, 0, 0),
      })
      break
    }
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const test = line + word
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line.trimEnd())
        line = word.trimStart()
      } else line = test
    }
    out.push(line)
  }
  return out
}

/** Embed an image asset (by id) and draw it. Used for images + signatures. */
export async function embedAsset(
  out: PDFDocument,
  page: PDFPage,
  assetId: string,
  rect: { x: number; y: number; w: number; h: number },
) {
  const rec = await getAsset(assetId)
  if (!rec) return
  const bytes = new Uint8Array(await rec.blob.arrayBuffer())
  const img =
    rec.mime === 'image/jpeg'
      ? await out.embedJpg(bytes)
      : await out.embedPng(bytes)
  const H = page.getHeight()
  page.drawImage(img, {
    x: rect.x,
    y: H - rect.y - rect.h,
    width: rect.w,
    height: rect.h,
  })
}
