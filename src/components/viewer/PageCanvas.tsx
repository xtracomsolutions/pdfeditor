import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getPageProxy } from '../../lib/pdf/registry'
import { TextLayer, type PDFPageProxy } from '../../lib/pdf/pdfjs'
import type { Annotation, DocPage } from '../../state/types'
import { useApp } from '../../state/store'
import { selectionQuads } from '../../lib/pdf/textMarkup'
import { makeTextMarkup } from '../../lib/annotations/factory'
import { AnnotationLayer } from './AnnotationLayer'
import { FormLayer } from './FormLayer'

interface Props {
  docId: string
  page: DocPage
  pageNumber: number
  scale: number
}

/**
 * One rendered page: a bitmap canvas, a selectable/searchable text layer, and
 * the annotation overlay. Rendering is deferred until the page nears the
 * viewport.
 */
function PageCanvasImpl({ docId, page, pageNumber, scale }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)
  const nightMode = useApp((s) => s.ui.nightMode)
  const tool = useApp((s) => s.ui.activeTool)
  const opts = useApp((s) => s.ui.tool)
  const addAnnotation = useApp((s) => s.addAnnotation)
  const annotationsMap = useApp((s) =>
    s.docs.find((d) => d.id === docId)?.annotations,
  )

  const pageAnnotations = useMemo<Annotation[]>(
    () =>
      annotationsMap
        ? Object.values(annotationsMap).filter((a) => a.pageId === page.id)
        : [],
    [annotationsMap, page.id],
  )

  const rotation = page.userRotation
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

    // blank / image pages have no PDF source
    if (page.sourceId == null) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (page.imageAssetId) {
          import('../../lib/storage/db').then(async ({ getAsset }) => {
            const rec = await getAsset(page.imageAssetId!)
            if (!rec || cancelled) return
            const bmp = await createImageBitmap(rec.blob)
            ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
            setRendered(true)
          })
        }
      }
      setRendered(true)
      return
    }

    ;(async () => {
      const proxyP = getPageProxy(docId, page.sourceId, page.sourceIndex)
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
          /* best-effort */
        }
      }
      if (!cancelled) setRendered(true)
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [
    visible,
    docId,
    page.sourceId,
    page.sourceIndex,
    page.imageAssetId,
    cssW,
    cssH,
    scale,
    rotation,
  ])

  // text-markup tools: turn the current text selection into an annotation
  const isMarkup =
    tool === 'highlight' || tool === 'underline' || tool === 'strikeout'

  const applyMarkupFromSelection = () => {
    const sel = window.getSelection()
    const textEl = textRef.current
    const wrap = wrapRef.current
    if (!sel || sel.isCollapsed || !textEl || !wrap) return
    if (!textEl.contains(sel.anchorNode) && !textEl.contains(sel.focusNode))
      return
    const range = sel.getRangeAt(0)
    const pageBox = wrap.getBoundingClientRect()
    const quads = selectionQuads(range, textEl, page, pageBox, scale)
    if (!quads.length) return
    addAnnotation(
      makeTextMarkup(
        page.id,
        tool as 'highlight' | 'underline' | 'strikeout',
        quads,
        opts,
      ),
    )
    sel.removeAllRanges()
  }

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative shrink-0 bg-paper shadow-[0_2px_16px_rgba(0,0,0,0.45)] ring-1 ring-black/20"
      style={{ width: cssW, height: cssH }}
      onMouseUp={isMarkup ? applyMarkupFromSelection : undefined}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          filter: nightMode ? 'invert(1) hue-rotate(180deg)' : undefined,
        }}
      />
      <div
        ref={textRef}
        className="textLayer"
        style={{ pointerEvents: isMarkup || tool === 'text-select' ? 'auto' : 'none' }}
      />
      {rendered && (
        <>
          <FormLayer docId={docId} page={page} scale={scale} />
          <AnnotationLayer
            docId={docId}
            page={page}
            scale={scale}
            annotations={pageAnnotations}
          />
        </>
      )}
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
