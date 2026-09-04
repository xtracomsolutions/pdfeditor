/**
 * pdf.js bootstrap. We host the worker ourselves (Vite `?worker`) so the app
 * works fully offline with no CDN dependency.
 */
import * as pdfjs from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved -- Vite worker import
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist/types/src/display/api'

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

export const { TextLayer } = pdfjs
export type { PDFDocumentProxy, PDFPageProxy }

export interface LoadedPdf {
  doc: PDFDocumentProxy
  pageCount: number
}

export async function loadPdf(data: Uint8Array): Promise<LoadedPdf> {
  // pdf.js transfers (neuters) the buffer it's given — hand it a copy so the
  // caller keeps its pristine original bytes for export.
  const copy = data.slice()
  const task = pdfjs.getDocument({
    data: copy,
    // Bundled standard fonts / cmaps (copied into /public/pdfjs) so rendering is
    // correct with no CDN. Keep in sync via `npm run sync:pdfjs`.
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    isEvalSupported: false,
  })
  const doc = await task.promise
  return { doc, pageCount: doc.numPages }
}

export interface RawOutlineItem {
  title: string
  dest: string | unknown[] | null
  items: RawOutlineItem[]
}

/** Resolve pdf.js outline destinations to 0-based page indices. */
export async function readOutline(doc: PDFDocumentProxy) {
  const raw = (await doc.getOutline()) as RawOutlineItem[] | null
  if (!raw) return []

  const resolve = async (
    dest: RawOutlineItem['dest'],
  ): Promise<number | null> => {
    try {
      const explicit =
        typeof dest === 'string' ? await doc.getDestination(dest) : dest
      if (!Array.isArray(explicit) || !explicit[0]) return null
      const ref = explicit[0] as { num: number; gen: number }
      const idx = await doc.getPageIndex(ref)
      return idx
    } catch {
      return null
    }
  }

  const walk = async (items: RawOutlineItem[]): Promise<
    { title: string; pageIndex: number | null; children: unknown[] }[]
  > =>
    Promise.all(
      items.map(async (it) => ({
        title: it.title,
        pageIndex: await resolve(it.dest),
        children: await walk(it.items ?? []),
      })),
    )

  return walk(raw)
}

export async function hasAcroForm(doc: PDFDocumentProxy): Promise<boolean> {
  try {
    const fields = await doc.getFieldObjects()
    return !!fields && Object.keys(fields).length > 0
  } catch {
    return false
  }
}

/** Quick heuristic: does the page already carry a real (non-OCR) text layer? */
export async function pageHasText(page: PDFPageProxy): Promise<boolean> {
  const content = await page.getTextContent()
  const chars = content.items.reduce(
    (n, it) => n + (('str' in it ? it.str : '') || '').trim().length,
    0,
  )
  return chars > 8
}

export { pdfjs }
