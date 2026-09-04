/**
 * Autosave every open document to IndexedDB, debounced. On next launch the
 * StartScreen offers to restore. Closing a doc drops its session.
 */
import { useEffect, useRef } from 'react'
import { useApp } from '../state/store'
import { registerPdf } from './pdf/registry'
import { loadPdf } from './pdf/pdfjs'
import {
  db,
  deleteSession,
  listSessions,
  saveSession,
  type SessionRecord,
} from './storage/db'
import type { OpenDoc } from '../state/types'

const DEBOUNCE = 1500

async function persist(doc: OpenDoc) {
  const rec: SessionRecord = {
    id: doc.id,
    name: doc.name,
    sources: doc.sources.map((s) => ({
      id: s.id,
      label: s.label,
      blob: new Blob([s.bytes as BlobPart], { type: 'application/pdf' }),
    })),
    pages: doc.pages,
    outline: doc.outline,
    annotations: doc.annotations,
    fieldValues: doc.fieldValues,
    hasAcroForm: doc.hasAcroForm,
    textLayerReady: doc.textLayerReady,
    savedAt: Date.now(),
  }
  await saveSession(rec)
}

export function useAutosave() {
  const timers = useRef<Map<string, number>>(new Map())
  const lastSig = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const unsub = useApp.subscribe((state, prev) => {
      if (state.docs === prev.docs) return
      for (const doc of state.docs) {
        if (!doc.dirty) continue
        const sig = `${doc.pages.length}:${Object.keys(doc.annotations).length}:${
          Object.keys(doc.fieldValues).length
        }:${JSON.stringify(doc.annotations).length}`
        if (lastSig.current.get(doc.id) === sig) continue
        lastSig.current.set(doc.id, sig)
        window.clearTimeout(timers.current.get(doc.id))
        timers.current.set(
          doc.id,
          window.setTimeout(() => void persist(doc), DEBOUNCE),
        )
      }
    })
    return () => {
      unsub()
      timers.current.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // drop sessions for docs that have been closed
  useEffect(() => {
    const unsub = useApp.subscribe(async (state, prev) => {
      const openNow = new Set(state.docs.map((d) => d.id))
      for (const d of prev.docs)
        if (!openNow.has(d.id)) await deleteSession(d.id)
    })
    return unsub
  }, [])
}

export interface RecoverableSession {
  id: string
  name: string
  pageCount: number
  savedAt: number
}

export async function listRecoverable(): Promise<RecoverableSession[]> {
  const sessions = await listSessions()
  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    pageCount: s.pages.length,
    savedAt: s.savedAt,
  }))
}

export async function restoreSession(id: string): Promise<string | null> {
  const rec = await db.sessions.get(id)
  if (!rec) return null

  const sources = await Promise.all(
    rec.sources.map(async (s) => ({
      id: s.id,
      label: s.label,
      bytes: new Uint8Array(await s.blob.arrayBuffer()),
    })),
  )

  // load every pdf source BEFORE the doc enters state, so the first render of
  // each page finds its proxy already registered
  const loaded = await Promise.all(
    sources.map(async (s) => ({ s, pdf: (await loadPdf(s.bytes)).doc })),
  )

  const meta: Omit<OpenDoc, 'id' | 'createdAt' | 'dirty'> = {
    name: rec.name,
    sources,
    pages: rec.pages,
    outline: rec.outline,
    annotations: rec.annotations,
    fieldValues: rec.fieldValues ?? {},
    hasAcroForm: rec.hasAcroForm,
    textLayerReady: rec.textLayerReady,
  }

  const newId = useApp.getState().addDoc(meta)
  for (const { s, pdf } of loaded) registerPdf(newId, s.id, pdf)
  await deleteSession(id)
  // rewrite the session under the new id so autosave keeps working
  void persist({ ...(meta as OpenDoc), id: newId, createdAt: Date.now(), dirty: false })
  return newId
}

export async function discardAllSessions() {
  const s = await listSessions()
  await Promise.all(s.map((x) => deleteSession(x.id)))
}
