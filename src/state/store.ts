/**
 * Global app state (Zustand + Immer).
 *
 * Undo/redo works on a per-document stack of snapshots covering the two mutable
 * parts of a document: its page list and its annotation map. Snapshots are cheap
 * (annotations are small plain objects; page records are tiny) which keeps the
 * command layer trivially correct — every mutating action calls `commit()`.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from '../lib/id'
import type {
  Annotation,
  DocPage,
  OpenDoc,
  OutlineNode,
  PdfSource,
  ToolId,
} from './types'

type FitMode = 'width' | 'page' | 'actual' | 'custom'

interface DocSnapshot {
  pages: DocPage[]
  annotations: Record<string, Annotation>
}

interface HistoryState {
  past: DocSnapshot[]
  future: DocSnapshot[]
}

export interface ToolOptions {
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
  highlightColor: string
  fontSize: number
  fontFamily: string
}

interface UIState {
  activeTool: ToolId
  zoom: number
  fitMode: FitMode
  nightMode: boolean
  spread: boolean
  showThumbnails: boolean
  showOutline: boolean
  showProperties: boolean
  searchOpen: boolean
  searchQuery: string
  selectedIds: string[]
  currentPage: number
  tool: ToolOptions
  /** An "armed" object waiting to be dropped on a page by the next click. */
  placement: Placement | null
}

export interface Placement {
  kind: 'signature' | 'image' | 'stamp'
  assetId?: string
  /** width / height, for sizing the dropped annotation */
  aspect?: number
  label?: string
  color?: string
  stampStyle?: 'approved' | 'draft' | 'confidential' | 'received' | 'custom'
}

export interface AppState {
  docs: OpenDoc[]
  activeDocId: string | null
  history: Record<string, HistoryState>
  ui: UIState

  // ---- document lifecycle ----
  addDoc: (doc: Omit<OpenDoc, 'id' | 'createdAt' | 'dirty'>) => string
  closeDoc: (id: string) => void
  setActiveDoc: (id: string) => void
  activeDoc: () => OpenDoc | null
  renameDoc: (id: string, name: string) => void

  // ---- annotations ----
  addAnnotation: (a: Annotation) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  removeAnnotations: (ids: string[]) => void

  // ---- pages ----
  reorderPage: (from: number, to: number) => void
  rotatePage: (pageId: string, delta: 90 | -90) => void
  deletePage: (pageId: string) => void
  deletePages: (pageIds: string[]) => void
  duplicatePage: (pageId: string) => void
  setPages: (pages: DocPage[]) => void
  addSource: (docId: string, source: PdfSource) => void
  /** Insert pages after `afterPageId` (null = prepend, undefined = append). */
  insertPages: (
    afterPageId: string | null | undefined,
    pages: DocPage[],
  ) => void
  setOutline: (outline: OutlineNode[]) => void
  markTextLayerReady: (docId: string) => void

  // ---- history ----
  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // ---- ui ----
  setTool: (t: ToolId) => void
  setPlacement: (p: Placement | null) => void
  setToolOption: <K extends keyof ToolOptions>(k: K, v: ToolOptions[K]) => void
  setZoom: (z: number, fit?: FitMode) => void
  setFitMode: (f: FitMode) => void
  toggleNight: () => void
  toggleSpread: () => void
  togglePanel: (p: 'showThumbnails' | 'showOutline' | 'showProperties') => void
  setSearch: (open: boolean, query?: string) => void
  select: (ids: string[], additive?: boolean) => void
  setCurrentPage: (n: number) => void
}

const HISTORY_LIMIT = 60

/** Deep clone of pure annotation/page data (no funcs, DOM nodes or proxies). */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function snapshot(doc: OpenDoc): DocSnapshot {
  return {
    pages: doc.pages.map((p) => ({ ...p })),
    annotations: clone(doc.annotations),
  }
}

export const useApp = create<AppState>()(
  immer((set, get) => ({
    docs: [],
    activeDocId: null,
    history: {},
    ui: {
      activeTool: 'select',
      zoom: 1,
      fitMode: 'width',
      nightMode: false,
      spread: false,
      showThumbnails: true,
      showOutline: false,
      showProperties: false,
      searchOpen: false,
      searchQuery: '',
      selectedIds: [],
      currentPage: 1,
      placement: null,
      tool: {
        stroke: '#e5484d',
        fill: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        highlightColor: '#ffd23f',
        fontSize: 14,
        fontFamily: 'Helvetica',
      },
    },

    addDoc: (input) => {
      const id = nanoid()
      set((s) => {
        s.docs.push({
          ...input,
          id,
          dirty: false,
          createdAt: Date.now(),
        })
        s.activeDocId = id
        s.history[id] = { past: [], future: [] }
        s.ui.currentPage = 1
        s.ui.selectedIds = []
      })
      return id
    },

    closeDoc: (id) =>
      set((s) => {
        s.docs = s.docs.filter((d) => d.id !== id)
        delete s.history[id]
        if (s.activeDocId === id)
          s.activeDocId = s.docs.length ? s.docs[s.docs.length - 1].id : null
      }),

    setActiveDoc: (id) =>
      set((s) => {
        s.activeDocId = id
        s.ui.selectedIds = []
        s.ui.currentPage = 1
      }),

    activeDoc: () => {
      const s = get()
      return s.docs.find((d) => d.id === s.activeDocId) ?? null
    },

    renameDoc: (id, name) =>
      set((s) => {
        const d = s.docs.find((x) => x.id === id)
        if (d) d.name = name
      }),

    addAnnotation: (a) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        d.annotations[a.id] = a
        d.dirty = true
        s.ui.selectedIds = [a.id]
      })
    },

    updateAnnotation: (id, patch) => {
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        const existing = d?.annotations[id]
        if (!d || !existing) return
        d.annotations[id] = {
          ...existing,
          ...patch,
          updatedAt: Date.now(),
        } as Annotation
        d.dirty = true
      })
    },

    removeAnnotations: (ids) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        for (const id of ids) delete d.annotations[id]
        d.dirty = true
        s.ui.selectedIds = s.ui.selectedIds.filter((x) => !ids.includes(x))
      })
    },

    reorderPage: (from, to) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const [moved] = d.pages.splice(from, 1)
        d.pages.splice(to, 0, moved)
        d.dirty = true
      })
    },

    rotatePage: (pageId, delta) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        const p = d?.pages.find((x) => x.id === pageId)
        if (!d || !p) return
        p.userRotation = (((p.userRotation + delta + 360) % 360) as
          | 0
          | 90
          | 180
          | 270)
        d.dirty = true
      })
    },

    deletePage: (pageId) => get().deletePages([pageId]),

    deletePages: (pageIds) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const remove = new Set(pageIds)
        if (d.pages.length - remove.size < 1) return
        d.pages = d.pages.filter((p) => !remove.has(p.id))
        for (const [aid, a] of Object.entries(d.annotations))
          if (remove.has(a.pageId)) delete d.annotations[aid]
        d.dirty = true
        s.ui.selectedIds = []
      })
    },

    duplicatePage: (pageId) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const idx = d.pages.findIndex((p) => p.id === pageId)
        if (idx < 0) return
        const src = d.pages[idx]
        d.pages.splice(idx + 1, 0, { ...src, id: nanoid() })
        d.dirty = true
      })
    },

    setPages: (pages) => {
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (d) {
          d.pages = pages
          d.dirty = true
        }
      })
    },

    addSource: (docId, source) =>
      set((s) => {
        const d = s.docs.find((x) => x.id === docId)
        if (d && !d.sources.some((src) => src.id === source.id))
          d.sources.push(source)
      }),

    insertPages: (afterPageId, pages) => {
      if (!pages.length) return
      get().commit()
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        let at: number
        if (afterPageId === null) at = 0
        else if (afterPageId === undefined) at = d.pages.length
        else {
          const i = d.pages.findIndex((p) => p.id === afterPageId)
          at = i < 0 ? d.pages.length : i + 1
        }
        d.pages.splice(at, 0, ...pages)
        d.dirty = true
        s.ui.selectedIds = []
      })
    },

    setOutline: (outline) =>
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (d) d.outline = outline
      }),

    markTextLayerReady: (docId) =>
      set((s) => {
        const d = s.docs.find((x) => x.id === docId)
        if (d) d.textLayerReady = true
      }),

    commit: () =>
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const h = s.history[d.id] ?? { past: [], future: [] }
        h.past.push(snapshot(d))
        if (h.past.length > HISTORY_LIMIT) h.past.shift()
        h.future = []
        s.history[d.id] = h
      }),

    undo: () =>
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const h = s.history[d.id]
        if (!h?.past.length) return
        const prev = h.past.pop()!
        h.future.push(snapshot(d))
        d.pages = prev.pages
        d.annotations = prev.annotations
        d.dirty = true
        s.ui.selectedIds = []
      }),

    redo: () =>
      set((s) => {
        const d = s.docs.find((x) => x.id === s.activeDocId)
        if (!d) return
        const h = s.history[d.id]
        if (!h?.future.length) return
        const next = h.future.pop()!
        h.past.push(snapshot(d))
        d.pages = next.pages
        d.annotations = next.annotations
        d.dirty = true
        s.ui.selectedIds = []
      }),

    canUndo: () => {
      const s = get()
      return (s.activeDocId && s.history[s.activeDocId]?.past.length > 0) || false
    },
    canRedo: () => {
      const s = get()
      return (
        (s.activeDocId && s.history[s.activeDocId]?.future.length > 0) || false
      )
    },

    setTool: (t) =>
      set((s) => {
        s.ui.activeTool = t
        if (t !== 'signature' && t !== 'image' && t !== 'stamp')
          s.ui.placement = null
      }),
    setPlacement: (p) =>
      set((s) => {
        s.ui.placement = p
      }),
    setToolOption: (k, v) =>
      set((s) => {
        s.ui.tool[k] = v
      }),
    setZoom: (z, fit) =>
      set((s) => {
        s.ui.zoom = Math.min(8, Math.max(0.1, z))
        s.ui.fitMode = fit ?? 'custom'
      }),
    setFitMode: (f) =>
      set((s) => {
        s.ui.fitMode = f
      }),
    toggleNight: () =>
      set((s) => {
        s.ui.nightMode = !s.ui.nightMode
      }),
    toggleSpread: () =>
      set((s) => {
        s.ui.spread = !s.ui.spread
      }),
    togglePanel: (p) =>
      set((s) => {
        s.ui[p] = !s.ui[p]
      }),
    setSearch: (open, query) =>
      set((s) => {
        s.ui.searchOpen = open
        if (query !== undefined) s.ui.searchQuery = query
      }),
    select: (ids, additive) =>
      set((s) => {
        s.ui.selectedIds = additive
          ? Array.from(new Set([...s.ui.selectedIds, ...ids]))
          : ids
      }),
    setCurrentPage: (n) =>
      set((s) => {
        s.ui.currentPage = n
      }),
  })),
)

if (import.meta.env.DEV)
  (window as unknown as { __app: typeof useApp }).__app = useApp
