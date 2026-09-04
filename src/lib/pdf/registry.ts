/**
 * Live pdf.js document proxies, keyed by `${docId}::${sourceId}`. A working
 * document can reference several PDF sources (the original plus any merged-in
 * files); each is loaded once and cached here, outside React/Zustand state.
 */
import { loadPdf, type PDFDocumentProxy, type PDFPageProxy } from './pdfjs'

interface Entry {
  doc: PDFDocumentProxy
  pages: Map<number, Promise<PDFPageProxy>>
}

const registry = new Map<string, Entry>()
const key = (docId: string, sourceId: string) => `${docId}::${sourceId}`

export function registerPdf(
  docId: string,
  sourceId: string,
  doc: PDFDocumentProxy,
) {
  registry.set(key(docId, sourceId), { doc, pages: new Map() })
}

/** Load + register a source if not already present. */
export async function ensureSource(
  docId: string,
  sourceId: string,
  bytes: Uint8Array,
) {
  if (registry.has(key(docId, sourceId))) return
  const { doc } = await loadPdf(bytes)
  registry.set(key(docId, sourceId), { doc, pages: new Map() })
}

export function getPdf(
  docId: string,
  sourceId: string,
): PDFDocumentProxy | undefined {
  return registry.get(key(docId, sourceId))?.doc
}

export function getPageProxy(
  docId: string,
  sourceId: string | null,
  sourceIndex: number,
): Promise<PDFPageProxy> | undefined {
  if (sourceId == null) return undefined
  const entry = registry.get(key(docId, sourceId))
  if (!entry) return undefined
  let p = entry.pages.get(sourceIndex)
  if (!p) {
    p = entry.doc.getPage(sourceIndex + 1)
    entry.pages.set(sourceIndex, p)
  }
  return p
}

export function disposePdf(docId: string) {
  for (const [k, entry] of registry)
    if (k.startsWith(`${docId}::`)) {
      entry.doc.destroy().catch(() => {})
      registry.delete(k)
    }
}
