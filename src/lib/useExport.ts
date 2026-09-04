import { useCallback, useState } from 'react'
import { useApp } from '../state/store'
import { exportPdf, type ExportOptions } from './export/exportPdf'

function triggerDownload(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function useExport() {
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (opts: ExportOptions = {}) => {
    const doc = useApp.getState().activeDoc()
    if (!doc) return
    setBusy(true)
    try {
      const bytes = await exportPdf(doc, opts)
      const base = doc.name.replace(/\.pdf$/i, '')
      triggerDownload(bytes, `${base} (redline).pdf`)
    } finally {
      setBusy(false)
    }
  }, [])

  return { run, busy }
}
