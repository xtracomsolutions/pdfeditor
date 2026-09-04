import { useCallback, useState } from 'react'
import { useApp } from '../state/store'
import { exportPdf, type ExportOptions } from './export/exportPdf'
import { exportRedacted } from './export/redact'

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

  const runRedacted = useCallback(async () => {
    const doc = useApp.getState().activeDoc()
    if (!doc) return
    setBusy(true)
    try {
      const bytes = await exportRedacted(doc)
      const base = doc.name.replace(/\.pdf$/i, '')
      triggerDownload(bytes, `${base} (redacted).pdf`)
    } finally {
      setBusy(false)
    }
  }, [])

  const hasRedactions = useApp((s) => {
    const d = s.docs.find((x) => x.id === s.activeDocId)
    return d
      ? Object.values(d.annotations).some((a) => a.kind === 'redaction')
      : false
  })

  return { run, runRedacted, busy, hasRedactions }
}
