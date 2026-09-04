import { memo, useEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useApp } from '../state/store'
import { getPageProxy } from '../lib/pdf/registry'
import { usePageOps } from '../lib/usePageOps'
import type { DocPage, OpenDoc } from '../state/types'
import {
  IconCopy,
  IconPlus,
  IconRotate,
  IconTrash,
} from './icons'

const THUMB_W = 128

const Thumb = memo(function Thumb({
  docId,
  page,
  n,
  active,
  selected,
  onClick,
}: {
  docId: string
  page: DocPage
  n: number
  active: boolean
  selected: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [seen, setSeen] = useState(false)
  const rot = page.userRotation % 180 === 0
  const w = THUMB_W
  const h =
    (w * (rot ? page.height : page.width)) / (rot ? page.width : page.height)

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
      const c = canvasRef.current
      if (!c) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (page.sourceId == null) {
        c.width = w * dpr
        c.height = h * dpr
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, c.width, c.height)
        if (page.imageAssetId) {
          const { getAsset } = await import('../lib/storage/db')
          const rec = await getAsset(page.imageAssetId)
          if (rec && !cancelled) {
            const bmp = await createImageBitmap(rec.blob)
            ctx.drawImage(bmp, 0, 0, c.width, c.height)
          }
        }
        return
      }
      const pp = getPageProxy(docId, page.sourceId, page.sourceIndex)
      if (!pp) return
      const proxy = await pp
      if (cancelled) return
      const vp = proxy.getViewport({ scale: 1, rotation: page.userRotation })
      const s = (THUMB_W * dpr) / vp.width
      const v = proxy.getViewport({ scale: s, rotation: page.userRotation })
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
  }, [seen, docId, page.sourceId, page.sourceIndex, page.userRotation, page.imageAssetId, w, h])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`group relative block w-full rounded-md p-1 text-left transition ${
        active
          ? 'bg-accent/15 ring-1 ring-accent'
          : selected
            ? 'bg-accent/10 ring-1 ring-accent/40'
            : 'hover:bg-white/5'
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
  const deletePages = useApp((s) => s.deletePages)
  const duplicatePage = useApp((s) => s.duplicatePage)
  const reorderPage = useApp((s) => s.reorderPage)
  const { insertBlank, insertImages, mergePdf, extractPages, splitAt } =
    usePageOps()

  const [sel, setSel] = useState<string[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const pick = (id: string, e: React.MouseEvent, i: number) => {
    if (e.shiftKey && sel.length) {
      const last = doc.pages.findIndex((p) => p.id === sel[sel.length - 1])
      const [a, b] = [last, i].sort((x, y) => x - y)
      setSel(doc.pages.slice(a, b + 1).map((p) => p.id))
    } else if (e.ctrlKey || e.metaKey) {
      setSel((s) =>
        s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
      )
    } else {
      setSel([id])
      goToPage(i + 1)
    }
  }

  const goToPage = (n: number) => {
    const node = document.querySelector<HTMLElement>(`[data-page="${n}"]`)
    const scroller = node?.closest('.chrome-scroll') as HTMLElement | null
    if (node && scroller)
      scroller.scrollTo({ top: node.offsetTop - 24, behavior: 'smooth' })
  }

  const pickFiles = (accept: string, fn: (files: File[]) => void) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = true
    input.onchange = () => input.files && fn(Array.from(input.files))
    input.click()
  }

  const anchorId = sel.length ? sel[sel.length - 1] : undefined

  return (
    <div
      data-thumbrail
      className="chrome-scroll flex h-full w-[168px] shrink-0 flex-col overflow-y-auto border-r border-chrome-line bg-ink"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-1 border-b border-chrome-line bg-ink px-2 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
          {sel.length ? `${sel.length} selected` : `${doc.pages.length} pages`}
        </span>
        <div className="flex items-center gap-0.5">
          {sel.length > 0 && (
            <>
              <button
                title="Extract to new document"
                onClick={() => extractPages(sel)}
                className="rounded p-1 text-chrome-muted hover:bg-white/10 hover:text-white"
              >
                <IconCopy width={14} height={14} />
              </button>
              <button
                title="Delete pages"
                onClick={() => {
                  deletePages(sel)
                  setSel([])
                }}
                className="rounded p-1 text-red-300 hover:bg-red-500/15"
              >
                <IconTrash width={14} height={14} />
              </button>
            </>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="Insert pages"
                className="rounded p-1 text-chrome-muted hover:bg-white/10 hover:text-white"
              >
                <IconPlus width={15} height={15} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 w-52 rounded-lg border border-chrome-line bg-ink-2 p-1 text-sm text-chrome-text shadow-2xl"
              >
                {[
                  ['Blank page', () => insertBlank(anchorId)],
                  [
                    'Image as page…',
                    () => pickFiles('image/*', (f) => insertImages(f, anchorId)),
                  ],
                  [
                    'Merge PDF…',
                    () =>
                      pickFiles('application/pdf', (f) => mergePdf(f, anchorId)),
                  ],
                ].map(([label, fn]) => (
                  <DropdownMenu.Item
                    key={label as string}
                    onSelect={fn as () => void}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    {label as string}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {doc.pages.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => {
              e.preventDefault()
              setOverIdx(i)
            }}
            onDrop={() => {
              if (dragIdx != null && dragIdx !== i) reorderPage(dragIdx, i)
              setDragIdx(null)
              setOverIdx(null)
            }}
            onDragEnd={() => {
              setDragIdx(null)
              setOverIdx(null)
            }}
            className={`relative rounded-md ${
              overIdx === i && dragIdx != null && dragIdx !== i
                ? 'ring-2 ring-accent'
                : ''
            }`}
          >
            <Thumb
              docId={doc.id}
              page={p}
              n={i + 1}
              active={current === i + 1}
              selected={sel.includes(p.id)}
              onClick={(e) => pick(p.id, e, i)}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="absolute right-1.5 top-1.5 hidden rounded bg-ink-3/90 p-1 text-chrome-muted hover:text-white group-hover:block data-[state=open]:block"
                  aria-label="Page actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconRotate width={13} height={13} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 w-44 rounded-lg border border-chrome-line bg-ink-2 p-1 text-sm text-chrome-text shadow-2xl"
                >
                  <DropdownMenu.Item
                    onSelect={() => rotatePage(p.id, -90)}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    Rotate left
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => rotatePage(p.id, 90)}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    Rotate right
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => duplicatePage(p.id)}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    Duplicate
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => insertBlank(p.id)}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                  >
                    Insert blank after
                  </DropdownMenu.Item>
                  {i > 0 && (
                    <DropdownMenu.Item
                      onSelect={() => splitAt(p.id)}
                      className="cursor-pointer rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-white/8"
                    >
                      Split here
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-chrome-line" />
                  <DropdownMenu.Item
                    onSelect={() => deletePages([p.id])}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-red-300 outline-none data-[highlighted]:bg-red-500/15"
                  >
                    Delete page
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        ))}
      </div>
    </div>
  )
}
