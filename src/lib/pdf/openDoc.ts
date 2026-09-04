/** Turn raw PDF bytes into an OpenDoc payload + its live pdf.js proxy. */
import { nanoid } from '../id'
import type { OpenDoc, OutlineNode } from '../../state/types'
import {
  hasAcroForm,
  loadPdf,
  pageHasText,
  readOutline,
  type PDFDocumentProxy,
} from './pdfjs'

export type DocMeta = Omit<OpenDoc, 'id' | 'createdAt' | 'dirty'>

export interface BuiltDoc {
  meta: DocMeta
  /** Live pdf.js proxy for sources[0]. */
  doc: PDFDocumentProxy
  sourceId: string
}

export async function buildOpenDoc(
  name: string,
  bytes: Uint8Array,
): Promise<BuiltDoc> {
  const { doc, pageCount } = await loadPdf(bytes)
  const sourceId = nanoid()

  const pages: DocMeta['pages'] = []
  let textChars = 0
  for (let i = 0; i < pageCount; i++) {
    const page = await doc.getPage(i + 1)
    const vp = page.getViewport({ scale: 1, rotation: 0 })
    pages.push({
      id: nanoid(),
      sourceId,
      sourceIndex: i,
      width: vp.width,
      height: vp.height,
      userRotation: 0,
    })
    if (i < 3 && (await pageHasText(page))) textChars++
  }

  const [rawOutline, acro] = await Promise.all([
    readOutline(doc),
    hasAcroForm(doc),
  ])

  return {
    doc,
    sourceId,
    meta: {
      name,
      sources: [{ id: sourceId, bytes, label: name }],
      pages,
      outline: rawOutline as OutlineNode[],
      annotations: {},
      hasAcroForm: acro,
      textLayerReady: textChars > 0,
    },
  }
}
