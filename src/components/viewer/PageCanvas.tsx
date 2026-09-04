import { memo, useEffect, useRef, useState } from 'react'
import { getPageProxy } from '../../lib/pdf/registry'
import { TextLayer, type PDFPageProxy } from '../../lib/pdf/pdfjs'
import type { DocPage } from '../../state/types'
import { useApp } from '../../state/store'

interface Props {
  docId: string
  page: DocPage
  pageNumber: number
  scale: number
}

/**
 * One rendered page: a bitmap canvas plus a selectable/searchable text layer.
 * Rendering is deferred until the page scrolls near the viewport.
 */
function PageCanvasImpl({ docId, page, pageNumber, scale }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)
  const nightMode = useApp((s) => s.ui.nightMode)

  const rotation = page.userRotation
  // pdf.js viewport at scale 1 gives unrotated size; rotation swaps axes.
  const rot = rotation % 180 === 0
  const cssW = (rot ? page.width : page.height) * scale
  const cssH = (rot ? page.height : page.width) * scale

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true)
      },
      { rootMargin: '1200px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: ReturnType<PDFPageProxy['render']> | null = null

    ;(async () => {
      const proxyP = getPageProxy(docId, page.sourceIndex)
      if (!proxyP) return
      const proxy = await proxyP
      if (cancelled) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = proxy.getViewport({ scale: scale * dpr, rotation })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      task = proxy.render({ canvas, canvasContext: ctx, viewport })
      try {
        await task.promise
      } catch {
        return
      }
      if (cancelled) return

      // text layer
      const textEl = textRef.current
      if (textEl) {
        textEl.replaceChildren()
        const tv = proxy.getViewport({ scale, rotation })
        textEl.style.setProperty('--scale-factor', String(scale))
        textEl.style.setProperty('--total-scale-factor', String(scale))
        try {
          const tl = new TextLayer({
            textContentSource: proxy.streamTextContent({
              includeMarkedContent: true,
            }),
            container: textEl,
            viewport: tv,
          })
          await tl.render()
        } catch {
          /* text layer is best-effort */
        }
      }
      if (!cancelled) setRendered(true)
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, docId, page.sourceIndex, scale, rotation])

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative shrink-0 bg-paper shadow-[0_2px_16px_rgba(0,0,0,0.45)] ring-1 ring-black/20"
      style={{ width: cssW, height: cssH }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          filter: nightMode ? 'invert(1) hue-rotate(180deg)' : undefined,
        }}
      />
      <div ref={textRef} className="textLayer" />
      {!rendered && (
        <div className="absolute inset-0 grid place-items-center text-body-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-paper-line border-t-accent" />
        </div>
      )}
      <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-chrome-muted">
        {pageNumber}
      </div>
    </div>
  )
}

export const PageCanvas = memo(PageCanvasImpl)
