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
npm install
npm run dev
npm run build      # tsc -b && vite build
```

## Status

Foundation + reader in place (open, virtualised render, zoom/fit, thumbnails,
outline, find, tabs, night mode, page rotate/delete/duplicate, undo/redo).
Next: annotation overlay + markup tools -> page ops -> fill/sign -> export
pipeline -> redaction -> OCR -> PWA polish.
