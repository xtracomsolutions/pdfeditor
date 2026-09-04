/**
 * Local persistence (IndexedDB via Dexie). Nothing here ever leaves the device.
 *
 *  - `sessions`  full working copies for crash recovery / "pick up where I left off"
 *  - `recents`   lightweight list for the start screen
 *  - `signatures` reusable drawn/typed/uploaded signatures
 *  - `assets`    binary blobs (inserted images, signature PNGs) referenced by id
 */
import Dexie, { type EntityTable } from 'dexie'
import type {
  Annotation,
  DocPage,
  OutlineNode,
  SavedSignature,
} from '../../state/types'

export interface SessionRecord {
  id: string
  name: string
  sources: { id: string; label: string; blob: Blob }[]
  pages: DocPage[]
  outline: OutlineNode[]
  annotations: Record<string, Annotation>
  fieldValues: Record<string, string | boolean>
  hasAcroForm: boolean
  textLayerReady: boolean
  savedAt: number
}

export interface RecentRecord {
  id: string
  name: string
  pageCount: number
  size: number
  openedAt: number
  thumbnail?: string
}

export interface AssetRecord {
  id: string
  blob: Blob
  mime: string
  createdAt: number
}

const db = new Dexie('redline') as Dexie & {
  sessions: EntityTable<SessionRecord, 'id'>
  recents: EntityTable<RecentRecord, 'id'>
  signatures: EntityTable<SavedSignature, 'id'>
  assets: EntityTable<AssetRecord, 'id'>
}

db.version(2).stores({
  sessions: 'id, savedAt, name',
  recents: 'id, openedAt',
  signatures: 'id, createdAt',
  assets: 'id, createdAt',
})

export { db }

export async function putRecent(rec: RecentRecord) {
  await db.recents.put(rec)
  // keep the list bounded
  const all = await db.recents.orderBy('openedAt').reverse().toArray()
  const stale = all.slice(24)
  if (stale.length) await db.recents.bulkDelete(stale.map((r) => r.id))
}

export async function listRecents(): Promise<RecentRecord[]> {
  return db.recents.orderBy('openedAt').reverse().toArray()
}

export async function saveSession(rec: SessionRecord) {
  await db.sessions.put(rec)
}

export async function loadSession(id: string) {
  return db.sessions.get(id)
}

export async function listSessions() {
  return db.sessions.orderBy('savedAt').reverse().toArray()
}

export async function deleteSession(id: string) {
  await db.sessions.delete(id)
}

export async function putAsset(id: string, blob: Blob) {
  await db.assets.put({ id, blob, mime: blob.type, createdAt: Date.now() })
}

export async function getAsset(id: string) {
  return db.assets.get(id)
}

export async function listSignatures() {
  return db.signatures.orderBy('createdAt').reverse().toArray()
}

export async function saveSignature(sig: SavedSignature) {
  await db.signatures.put(sig)
}

export async function deleteSignature(id: string) {
  await db.signatures.delete(id)
}
