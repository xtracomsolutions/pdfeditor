# Redline

A local-first PDF reader and editor. Read, mark up, fill, sign, reorganise and
redact PDFs entirely in the browser — nothing is uploaded, no account is needed.
Installable as a PWA and fully functional offline.

Built for **Xtracom Solutions**.

## Stack

| Concern      | Tool                                              |
| ------------ | ------------------------------------------------- |
| Build / PWA  | Vite 7, `vite-plugin-pwa` (Workbox)               |
| UI           | React 19 + TypeScript, Tailwind v4, Radix         |
| State        | Zustand + Immer, snapshot-based undo/redo         |
| Render       | pdf.js (`pdfjs-dist`), self-hosted worker         |
| Write        | `pdf-lib` + `@pdf-lib/fontkit`                    |
| OCR          | `tesseract.js` (lazy-loaded)                      |
| Storage      | IndexedDB via Dexie (autosave, recents, sigs)     |

## Architecture

The **annotation model** is the single source of truth. Every geometric value is
stored in PDF points (top-left origin) so it is independent of zoom/DPI.

```
tools → commands → annotation model (Zustand)
                        |  autosave        |  export
                        v                  v
                    IndexedDB          pdf-lib pipeline
```

- `src/state/`      store, types, history
- `src/lib/pdf/`    pdf.js bootstrap, doc loading, live-proxy registry
- `src/lib/storage/` Dexie schema + helpers
- `src/components/` shell, toolbar, rails, viewer

## Develop

```bash
npm install        # postinstall vendors pdf.js + tesseract assets into /public
npm run dev
npm run build      # tsc -b && vite build (prebuild re-syncs assets)
```

`scripts/sync-assets.mjs` copies the pdf.js cmaps/fonts and the tesseract
worker/wasm core into `/public`, and downloads the English OCR model once.
Those folders are git-ignored and regenerated.

## Features

**Read** — virtualised rendering, continuous scroll, thumbnail rail, outline,
full-text find, night mode, fit modes, multi-document tabs.

**Mark up** — highlight / underline / strikeout snapped to real text, ink,
rectangle / ellipse / line / arrow, text box, sticky note, stamps, images.
Select / move / resize / restyle; snapshot undo/redo over everything.

**Pages** — reorder (drag), rotate, duplicate, delete, insert blank, insert
image as page, merge PDFs, extract to a new tab, split.

**Fill & sign** — AcroForm detection + overlay fill, signature manager
(draw / type / upload, saved & reusable).

**Edit text** — white-out in the sampled background colour + retype.

**Redact** — "Apply redactions & export" rasterises affected pages so nothing
survives under the mark; clean pages stay vector text.

**OCR** — on-device (tesseract.js), makes scans searchable and markable.

**Export** — Flattened PDF, or a Redline PDF that looks flattened everywhere
but reopens here with every markup still editable (model embedded in the
catalog).

**Offline** — installable PWA; OCR engine + CJK cmaps cached on first use.
