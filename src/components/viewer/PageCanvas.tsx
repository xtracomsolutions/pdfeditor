import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getPageProxy } from '../../lib/pdf/registry'
import { TextLayer, type PDFPageProxy } from '../../lib/pdf/pdfjs'
import type { Annotation, DocPage, Rect } from '../../state/types'
import { useApp } from '../../state/store'
import { selectionQuads } from '../../lib/pdf/textMarkup'
import {
  makeTextMarkup,
  makeTextBox,
  makeWhiteout,
} from '../../lib/annotations/factory'
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
  const addAnnotations = useApp((s) => s.addAnnotations)
  const annotationsMap = useApp((s) =>
    s.docs.find((d) => d.id === docId)?.annotations,
  )
  const ocrWords = useApp((s) => s.docs.find((d) => d.id === docId)?.ocr?.[page.id])

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
        // fall back to an OCR-backed text layer for scanned pages
        if (!textEl.textContent?.trim() && ocrWords?.length) {
          renderOcrLayer(textEl, ocrWords, scale)
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
    ocrWords,
    cssW,
    cssH,
    scale,
    rotation,
  ])

  // text-markup tools: turn the current text selection into an annotation
  const isMarkup =
    tool === 'highlight' ||
    tool === 'underline' ||
    tool === 'strikeout' ||
    tool === 'replace-text'

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
    const text = sel.toString()

    if (tool === 'replace-text') {
      const union = quads.reduce((u, q) => ({
        x: Math.min(u.x, q.x),
        y: Math.min(u.y, q.y),
        w: Math.max(u.x + u.w, q.x + q.w) - Math.min(u.x, q.x),
        h: Math.max(u.y + u.h, q.y + q.h) - Math.min(u.y, q.y),
      }))
      const bg = sampleBackground(canvasRef.current, union, scale, rotation)
      const fontSize = Math.round(
        (quads.reduce((n, q) => n + q.h, 0) / quads.length) * 0.82,
      )
      const pad = 1.5
      addAnnotations([
        makeWhiteout(
          page.id,
          {
            x: union.x - pad,
            y: union.y - pad,
            w: union.w + pad * 2,
            h: union.h + pad * 2,
          },
          bg,
        ),
        {
          ...makeTextBox(
            page.id,
            { x: union.x, y: union.y - 1, w: Math.max(union.w, 40), h: union.h + 4 },
            { ...opts, fontSize },
            'textbox',
          ),
          text,
          background: 'transparent',
          borderColor: 'transparent',
          color: '#16191d',
        },
      ])
      sel.removeAllRanges()
      return
    }

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

/**
 * Estimate the page background colour just outside a text rect by sampling the
 * rendered canvas a few px above it. Falls back to white.
 */
function sampleBackground(
  canvas: HTMLCanvasElement | null,
  rect: Rect,
  scale: number,
  rotation: 0 | 90 | 180 | 270,
): string {
  if (!canvas || rotation !== 0) return '#ffffff'
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !canvas.clientWidth) return '#ffffff'
    const k = (canvas.width / canvas.clientWidth) * scale // pt -> device px
    const sx = Math.max(0, Math.round((rect.x + 2) * k))
    const sy = Math.max(0, Math.round((rect.y - 3) * k))
    const strip = ctx.getImageData(sx, sy, Math.min(24, canvas.width - sx), 2)
    let r = 0
    let g = 0
    let b = 0
    const n = strip.data.length / 4
    for (let i = 0; i < strip.data.length; i += 4) {
      r += strip.data[i]
      g += strip.data[i + 1]
      b += strip.data[i + 2]
    }
    if (!n) return '#ffffff'
    const hex = (v: number) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0')
    return `#${hex(r)}${hex(g)}${hex(b)}`
  } catch {
    return '#ffffff'
  }
}

/** Build a selectable/searchable text layer from OCR word boxes. */
function renderOcrLayer(
  container: HTMLElement,
  words: { text: string; x: number; y: number; w: number; h: number }[],
  scale: number,
) {
  const frag = document.createDocumentFragment()
  for (const w of words) {
    const span = document.createElement('span')
    span.textContent = w.text + ' '
    span.style.cssText = `left:${w.x * scale}px;top:${w.y * scale}px;font-size:${
      w.h * scale
    }px;line-height:1;color:transparent;position:absolute;white-space:pre;transform:none`
    frag.appendChild(span)
  }
  container.appendChild(frag)
}
