/**
 * On-device OCR (tesseract.js). All assets are self-hosted under /tesseract so
 * this works with no network. Produces word boxes in unrotated PDF points so
 * the result can back a synthetic text layer.
 */
import { createWorker, type Worker } from 'tesseract.js'
import type { OcrWord } from '../../state/types'

const base = import.meta.env.BASE_URL

let workerPromise: Promise<Worker> | null = null

async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: `${base}tesseract/worker.min.js`,
      // pin one core build so we only ship/precache a single wasm
      corePath: `${base}tesseract/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${base}tesseract/lang`,
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') onProgress?.(m.progress)
      },
    })
  }
  return workerPromise
}

interface TWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}
interface TLine {
  words: TWord[]
}
interface TPara {
  lines: TLine[]
}
interface TBlock {
  paragraphs: TPara[]
}

/**
 * OCR one already-rendered page canvas. `renderScale` is the pdf.js scale used
 * to draw it (image px = pdf pt * renderScale).
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  renderScale: number,
  onProgress?: (p: number) => void,
): Promise<OcrWord[]> {
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(canvas, {}, { blocks: true })
  const out: OcrWord[] = []
  const blocks = (data.blocks ?? []) as unknown as TBlock[]
  for (const b of blocks)
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? [])
        for (const w of l.words ?? []) {
          const t = w.text?.trim()
          if (!t) continue
          out.push({
            text: t,
            x: w.bbox.x0 / renderScale,
            y: w.bbox.y0 / renderScale,
            w: (w.bbox.x1 - w.bbox.x0) / renderScale,
            h: (w.bbox.y1 - w.bbox.y0) / renderScale,
          })
        }
  return out
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise
    await w.terminate()
    workerPromise = null
  }
}
