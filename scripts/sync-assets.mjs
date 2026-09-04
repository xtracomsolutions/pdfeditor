/**
 * Copies vendored runtime assets into /public so the app works fully offline
 * with no CDN. Run automatically on `postinstall` and `prebuild`.
 *
 *  - pdf.js  : cmaps + standard_fonts
 *  - tesseract: worker + wasm core, plus the English model (downloaded once)
 */
import { cpSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const log = (m) => console.log(`[sync-assets] ${m}`)

// pdf.js
for (const d of ['cmaps', 'standard_fonts']) {
  cpSync(`node_modules/pdfjs-dist/${d}`, `public/pdfjs/${d}`, { recursive: true })
}
log('pdf.js cmaps + standard_fonts')

// tesseract core + worker
mkdirSync('public/tesseract/lang', { recursive: true })
cpSync('node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker.min.js')
for (const f of [
  'tesseract-core-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
]) {
  cpSync(`node_modules/tesseract.js-core/${f}`, `public/tesseract/${f}`)
}
log('tesseract worker + wasm core')

// English model (once)
const model = 'public/tesseract/lang/eng.traineddata.gz'
if (!existsSync(model)) {
  const url =
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
  log(`downloading English model from ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`model download failed: ${res.status}`)
  await pipeline(res.body, createWriteStream(model))
  log('English model saved')
} else {
  log('English model already present')
}
