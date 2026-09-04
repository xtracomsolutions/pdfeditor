import { useCallback } from 'react'
import { useApp } from '../state/store'
import type { Annotation, DocPage, OpenDoc } from '../state/types'
import { nanoid } from './id'
import { loadPdf } from './pdf/pdfjs'
import { ensureSource, registerPdf } from './pdf/registry'
import { putAsset } from './storage/db'

const A4 = { w: 595.28, h: 841.89 }

function blankPage(size: { w: number; h: number }): DocPage {
  return {
    id: nanoid(),
    sourceId: null,
    sourceIndex: -1,
    width: size.w,
    height: size.h,
    userRotation: 0,
  }
}

export function usePageOps() {
  const insertPages = useApp((s) => s.insertPages)
  const addSource = useApp((s) => s.addSource)
  const addDoc = useApp((s) => s.addDoc)
  const deletePages = useApp((s) => s.deletePages)

  const insertBlank = useCallback(
    (afterPageId?: string | null) => {
      const doc = useApp.getState().activeDoc()
      const ref = doc?.pages.find((p) => p.id === afterPageId) ?? doc?.pages[0]
      insertPages(afterPageId, [
        blankPage(ref ? { w: ref.width, h: ref.height } : A4),
      ])
    },
    [insertPages],
  )

  const insertImages = useCallback(
    async (files: File[], afterPageId?: string | null) => {
      const pages: DocPage[] = []
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue
        const bmp = await createImageBitmap(f)
        const assetId = nanoid()
        await putAsset(assetId, f)
        // fit within an A4 page
        const scale = Math.min(A4.w / bmp.width, A4.h / bmp.height, 1)
        pages.push({
          id: nanoid(),
          sourceId: null,
          sourceIndex: -1,
          imageAssetId: assetId,
          width: bmp.width * scale,
          height: bmp.height * scale,
          userRotation: 0,
        })
      }
      if (pages.length) insertPages(afterPageId, pages)
    },
    [insertPages],
  )

  const mergePdf = useCallback(
    async (files: File[], afterPageId?: string | null) => {
      const doc = useApp.getState().activeDoc()
      if (!doc) return
      const newPages: DocPage[] = []
      for (const f of files) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))
          continue
        const bytes = new Uint8Array(await f.arrayBuffer())
        const { doc: pdf, pageCount } = await loadPdf(bytes)
        const sourceId = nanoid()
        addSource(doc.id, { id: sourceId, bytes, label: f.name })
        registerPdf(doc.id, sourceId, pdf)
        for (let i = 0; i < pageCount; i++) {
          const vp = (await pdf.getPage(i + 1)).getViewport({
            scale: 1,
            rotation: 0,
          })
          newPages.push({
            id: nanoid(),
            sourceId,
            sourceIndex: i,
            width: vp.width,
            height: vp.height,
            userRotation: 0,
          })
        }
      }
      if (newPages.length) insertPages(afterPageId, newPages)
    },
    [addSource, insertPages],
  )

  /** Build a new working doc from a subset of the active doc's pages. */
  const makeDocFromPages = useCallback(
    async (
      src: OpenDoc,
      pageIds: string[],
      name: string,
    ): Promise<string | null> => {
      const picked = src.pages.filter((p) => pageIds.includes(p.id))
      if (!picked.length) return null
      const usedSources = new Set(
        picked.map((p) => p.sourceId).filter(Boolean) as string[],
      )
      const sources = src.sources.filter((s) => usedSources.has(s.id))
      const annotations: Record<string, Annotation> = {}
      const newPages = picked.map((p) => {
        const np = { ...p, id: nanoid() }
        for (const a of Object.values(src.annotations))
          if (a.pageId === p.id)
            annotations[nanoid()] = { ...structuredCloneSafe(a), pageId: np.id }
        return np
      })
      const newId = addDoc({
        name,
        sources,
        pages: newPages,
        outline: [],
        annotations,
        hasAcroForm: false,
        textLayerReady: src.textLayerReady,
      })
      for (const s of sources) await ensureSource(newId, s.id, s.bytes)
      return newId
    },
    [addDoc],
  )

  const extractPages = useCallback(
    async (pageIds: string[]) => {
      const src = useApp.getState().activeDoc()
      if (!src) return
      const base = src.name.replace(/\.pdf$/i, '')
      await makeDocFromPages(src, pageIds, `${base} — extract.pdf`)
    },
    [makeDocFromPages],
  )

  const splitAt = useCallback(
    async (pageId: string) => {
      const src = useApp.getState().activeDoc()
      if (!src) return
      const idx = src.pages.findIndex((p) => p.id === pageId)
      if (idx <= 0) return
      const tailIds = src.pages.slice(idx).map((p) => p.id)
      const base = src.name.replace(/\.pdf$/i, '')
      await makeDocFromPages(src, tailIds, `${base} — part 2.pdf`)
      // switch back and trim the tail from the original
      useApp.getState().setActiveDoc(src.id)
      deletePages(tailIds)
    },
    [makeDocFromPages, deletePages],
  )

  return { insertBlank, insertImages, mergePdf, extractPages, splitAt }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
