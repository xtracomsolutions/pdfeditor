/**
 * Live pdf.js document proxies, keyed by the store's docId. These hold worker
 * handles and rendering caches, so they live outside React/Zustand state.
 */
import type { PDFDocumentProxy, PDFPageProxy } from './pdfjs'

interface Entry {
  doc: PDFDocumentProxy
  pages: Map<number, Promise<PDFPageProxy>>
}

const registry = new Map<string, Entry>()

export function registerPdf(docId: string, doc: PDFDocumentProxy) {
  registry.set(docId, { doc, pages: new Map() })
}

export function getPdf(docId: string): PDFDocumentProxy | undefined {
  return registry.get(docId)?.doc
}

export function getPageProxy(
  docId: string,
  sourceIndex: number,
): Promise<PDFPageProxy> | undefined {
  const entry = registry.get(docId)
  if (!entry) return undefined
  let p = entry.pages.get(sourceIndex)
  if (!p) {
    p = entry.doc.getPage(sourceIndex + 1)
    entry.pages.set(sourceIndex, p)
  }
  return p
}

export function disposePdf(docId: string) {
  const entry = registry.get(docId)
  if (!entry) return
  entry.doc.destroy().catch(() => {})
  registry.delete(docId)
}
