import { useCallback } from 'react'
import { useApp } from '../state/store'
import { buildOpenDoc } from './pdf/openDoc'
import { registerPdf } from './pdf/registry'
import { putRecent } from './storage/db'
import { nanoid } from './id'

export function useOpenFiles() {
  const addDoc = useApp((s) => s.addDoc)

  const openBytes = useCallback(
    async (name: string, bytes: Uint8Array, size: number) => {
      const { meta, doc } = await buildOpenDoc(name, bytes)
      const id = addDoc(meta)
      registerPdf(id, doc)
      void putRecent({
        id: nanoid(),
        name,
        pageCount: meta.pageCount,
        size,
        openedAt: Date.now(),
      })
      return id
    },
    [addDoc],
  )

  const openFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfs = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      )
      for (const f of pdfs) {
        const buf = new Uint8Array(await f.arrayBuffer())
        await openBytes(f.name, buf, f.size)
      }
      return pdfs.length
    },
    [openBytes],
  )

  const pickFiles = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf'
    input.multiple = true
    input.onchange = () => {
      if (input.files?.length) void openFiles(input.files)
    }
    input.click()
  }, [openFiles])

  return { openFiles, openBytes, pickFiles }
}
