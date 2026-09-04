import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useApp } from '../state/store'
import { nanoid } from '../lib/id'
import {
  deleteSignature,
  listSignatures,
  putAsset,
  saveSignature,
} from '../lib/storage/db'
import type { SavedSignature } from '../state/types'
import { IconTrash, IconX } from './icons'

/** Trim transparent margins and return a PNG blob + aspect ratio. */
async function trimToPng(
  canvas: HTMLCanvasElement,
): Promise<{ blob: Blob; aspect: number } | null> {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let any = false
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        any = true
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  if (!any) return null
  const pad = 6
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width, maxX + pad)
  maxY = Math.min(height, maxY + pad)
  const w = maxX - minX
  const h = maxY - minY
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h)
  const blob: Blob = await new Promise((res) =>
    out.toBlob((b) => res(b!), 'image/png'),
  )
  return { blob, aspect: w / h }
}

function DrawPad({ onReady }: { onReady: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)

  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0b1220'
  }, [])

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  return (
    <canvas
      ref={ref}
      className="h-40 w-full touch-none rounded-md border border-paper-line bg-white"
      onPointerDown={(e) => {
        drawing.current = true
        last.current = pos(e)
        ref.current!.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const ctx = ref.current!.getContext('2d')!
        const p = pos(e)
        ctx.beginPath()
        ctx.moveTo(...(last.current as [number, number]))
        ctx.lineTo(...p)
        ctx.stroke()
        last.current = p
      }}
      onPointerUp={() => {
        drawing.current = false
        onReady(ref.current!)
      }}
    />
  )
}

function typeToCanvas(text: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 200
  const ctx = c.getContext('2d')!
  ctx.font = "64px 'Segoe Script', 'Bradley Hand', cursive"
  ctx.fillStyle = '#0b1220'
  ctx.textBaseline = 'middle'
  ctx.fillText(text || ' ', 20, 100)
  return c
}

export function SignatureDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const setPlacement = useApp((s) => s.setPlacement)
  const setTool = useApp((s) => s.setTool)
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw')
  const [typed, setTyped] = useState('')
  const [saved, setSaved] = useState<SavedSignature[]>([])
  const pending = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (open) void listSignatures().then(setSaved)
  }, [open])

  const commit = async (
    canvas: HTMLCanvasElement | null,
    kind: SavedSignature['kind'],
  ) => {
    if (!canvas) return
    const res = await trimToPng(canvas)
    if (!res) return
    const assetId = nanoid()
    await putAsset(assetId, res.blob)
    const dataUrl = await blobToDataUrl(res.blob)
    const sig: SavedSignature = {
      id: nanoid(),
      kind,
      dataUrl,
      createdAt: Date.now(),
    }
    await saveSignature(sig)
    arm(assetId, res.aspect)
  }

  const applySaved = async (sig: SavedSignature) => {
    const assetId = nanoid()
    const blob = await (await fetch(sig.dataUrl)).blob()
    await putAsset(assetId, blob)
    const img = new Image()
    img.src = sig.dataUrl
    await img.decode()
    arm(assetId, img.width / img.height)
  }

  const arm = (assetId: string, aspect: number) => {
    setPlacement({ kind: 'signature', assetId, aspect })
    setTool('signature')
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-chrome-line bg-ink-2 p-4 text-chrome-text shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-display text-base font-semibold">
              Add signature
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-chrome-muted hover:bg-white/10">
              <IconX />
            </Dialog.Close>
          </div>

          {saved.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-chrome-muted">
                Saved
              </div>
              <div className="flex flex-wrap gap-2">
                {saved.map((s) => (
                  <div key={s.id} className="group relative">
                    <button
                      onClick={() => applySaved(s)}
                      className="h-12 w-28 rounded-md border border-chrome-line bg-white p-1"
                    >
                      <img
                        src={s.dataUrl}
                        alt="signature"
                        className="h-full w-full object-contain"
                      />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteSignature(s.id)
                        setSaved(await listSignatures())
                      }}
                      className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-ink-3 p-0.5 text-red-300 group-hover:block"
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex gap-1 text-xs">
            {(['draw', 'type', 'upload'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-2.5 py-1 capitalize ${
                  tab === t
                    ? 'bg-accent/20 text-accent'
                    : 'text-chrome-muted hover:bg-white/8'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'draw' && (
            <>
              <DrawPad onReady={(c) => (pending.current = c)} />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => commit(pending.current, 'drawn')}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  Use signature
                </button>
              </div>
            </>
          )}

          {tab === 'type' && (
            <>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type your name"
                className="w-full rounded-md border border-chrome-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div
                className="mt-2 grid h-24 place-items-center rounded-md border border-paper-line bg-white text-4xl text-ink"
                style={{ fontFamily: "'Segoe Script','Bradley Hand',cursive" }}
              >
                {typed || 'Preview'}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => commit(typeToCanvas(typed), 'typed')}
                  disabled={!typed.trim()}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-40"
                >
                  Use signature
                </button>
              </div>
            </>
          )}

          {tab === 'upload' && (
            <label className="flex h-32 cursor-pointer items-center justify-center rounded-md border border-dashed border-chrome-line text-sm text-chrome-muted hover:border-accent">
              Choose an image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const assetId = nanoid()
                  await putAsset(assetId, f)
                  const bmp = await createImageBitmap(f)
                  await saveSignature({
                    id: nanoid(),
                    kind: 'image',
                    dataUrl: await blobToDataUrl(f),
                    createdAt: Date.now(),
                  })
                  arm(assetId, bmp.width / bmp.height)
                }}
              />
            </label>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(blob)
  })
}
