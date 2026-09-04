import { useCallback } from 'react'
import { useApp } from '../state/store'
import { getPageProxy } from './pdf/registry'
import { ocrCanvas } from './ocr/ocr'

const OCR_SCALE = 2

/** Run OCR across every PDF-backed page of the active document. */
export function useOcr() {
  const setPageOcr = useApp((s) => s.setPageOcr)
  const setOcrProgress = useApp((s) => s.setOcrProgress)

  const runOcr = useCallback(async () => {
    const doc = useApp.getState().activeDoc()
    if (!doc) return
    const pages = doc.pages.filter((p) => p.sourceId != null)
    setOcrProgress({ page: 0, total: pages.length, progress: 0 })
    try {
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]
        const proxyP = getPageProxy(doc.id, p.sourceId, p.sourceIndex)
        if (!proxyP) continue
        const proxy = await proxyP
        const viewport = proxy.getViewport({ scale: OCR_SCALE, rotation: 0 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await proxy.render({ canvas, canvasContext: ctx, viewport }).promise

        const words = await ocrCanvas(canvas, OCR_SCALE, (pr) =>
          setOcrProgress({ page: i + 1, total: pages.length, progress: pr }),
        )
        setPageOcr(doc.id, p.id, words)
        setOcrProgress({
          page: i + 1,
          total: pages.length,
          progress: 1,
        })
      }
    } finally {
      setOcrProgress(null)
    }
  }, [setPageOcr, setOcrProgress])

  return { runOcr }
}
