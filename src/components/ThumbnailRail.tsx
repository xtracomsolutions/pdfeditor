import { memo, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/store'
import { getPageProxy } from '../lib/pdf/registry'
import type { DocPage, OpenDoc } from '../state/types'
import { IconRotate, IconTrash, IconCopy } from './icons'

const THUMB_W = 132

const Thumb = memo(function Thumb({
  docId,
  page,
  n,
  active,
  onClick,
}: {
  docId: string
  page: DocPage
  n: number
  active: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [seen, setSeen] = useState(false)
  const rot = page.userRotation % 180 === 0
  const w = THUMB_W
  const h = (w * (rot ? page.height : page.width)) / (rot ? page.width : page.height)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (e) => e[0]?.isIntersecting && setSeen(true),
      { root: el.closest('[data-thumbrail]'), rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!seen) return
    let cancelled = false
    ;(async () => {
      const pp = getPageProxy(docId, page.sourceIndex)
      if (!pp) return
      const proxy = await pp
      if (cancelled) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = proxy.getViewport({ scale: 1, rotation: page.userRotation })
      const s = ((THUMB_W * dpr) / vp.width)
      const v = proxy.getViewport({ scale: s, rotation: page.userRotation })
      const c = canvasRef.current
      if (!c) return
      c.width = v.width
      c.height = v.height
      const ctx = c.getContext('2d', { alpha: false })
      if (!ctx) return
      try {
        await proxy.render({ canvas: c, canvasContext: ctx, viewport: v }).promise
      } catch {
        /* noop */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [seen, docId, page.sourceIndex, page.userRotation])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`group relative block rounded-md p-1 transition ${
        active ? 'bg-accent/15 ring-1 ring-accent' : 'hover:bg-white/5'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="mx-auto rounded-sm bg-paper ring-1 ring-black/30"
        style={{ width: w, height: h }}
      />
      <span className="mt-1 block text-center text-[11px] text-chrome-muted">
        {n}
      </span>
    </button>
  )
})

export function ThumbnailRail({ doc }: { doc: OpenDoc }) {
  const current = useApp((s) => s.ui.currentPage)
  const rotatePage = useApp((s) => s.rotatePage)
  const deletePage = useApp((s) => s.deletePage)
  const duplicatePage = useApp((s) => s.duplicatePage)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const goToPage = (n: number) => {
    const scroller = document.querySelector('[data-page]')?.closest('.chrome-scroll')
    const node = document.querySelector<HTMLElement>(`[data-page="${n}"]`)
    if (node && scroller) {
      ;(scroller as HTMLElement).scrollTo({
        top: node.offsetTop - 24,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div
      data-thumbrail
      className="chrome-scroll h-full w-[172px] shrink-0 overflow-y-auto border-r border-chrome-line bg-ink px-2 py-3"
    >
      <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
        Pages · {doc.pages.length}
      </div>
      <div className="flex flex-col gap-1">
        {doc.pages.map((p, i) => (
          <div
            key={p.id}
            className="relative"
            onMouseLeave={() => setMenuFor(null)}
          >
            <Thumb
              docId={doc.id}
              page={p}
              n={i + 1}
              active={current === i + 1}
              onClick={() => goToPage(i + 1)}
            />
            <button
              onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
              className="absolute right-1 top-1 hidden rounded bg-ink-3/90 p-1 text-chrome-muted hover:text-white group-hover:block"
              aria-label="Page actions"
            >
              <IconRotate width={13} height={13} />
            </button>
            {menuFor === p.id && (
              <div className="absolute right-1 top-8 z-10 flex gap-1 rounded-md border border-chrome-line bg-ink-2 p-1 shadow-xl">
                <button
                  className="rounded p-1.5 text-chrome-muted hover:bg-white/10 hover:text-white"
                  onClick={() => rotatePage(p.id, -90)}
                  title="Rotate left"
                >
                  <IconRotate width={15} height={15} className="-scale-x-100" />
                </button>
                <button
                  className="rounded p-1.5 text-chrome-muted hover:bg-white/10 hover:text-white"
                  onClick={() => rotatePage(p.id, 90)}
                  title="Rotate right"
                >
                  <IconRotate width={15} height={15} />
                </button>
                <button
                  className="rounded p-1.5 text-chrome-muted hover:bg-white/10 hover:text-white"
                  onClick={() => duplicatePage(p.id)}
                  title="Duplicate"
                >
                  <IconCopy width={15} height={15} />
                </button>
                <button
                  className="rounded p-1.5 text-red-300 hover:bg-red-500/15"
                  onClick={() => {
                    deletePage(p.id)
                    setMenuFor(null)
                  }}
                  title="Delete page"
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
