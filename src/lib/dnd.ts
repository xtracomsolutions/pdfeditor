/** Drag-and-drop payload shared between the thumbnail rail and the tab strip. */
export const PAGE_DRAG_MIME = 'application/x-redline-page'

export interface PageDragPayload {
  docId: string
  pageId: string
}

export function readPageDrag(dt: DataTransfer): PageDragPayload | null {
  try {
    const raw = dt.getData(PAGE_DRAG_MIME)
    if (!raw) return null
    return JSON.parse(raw) as PageDragPayload
  } catch {
    return null
  }
}
