/**
 * Core domain types for Redline.
 *
 * The annotation model is the single source of truth. Every geometric value is
 * stored in **PDF points** (1/72 inch), origin at the page's top-left, y growing
 * downward — a screen-friendly convention we convert to PDF's bottom-left origin
 * only at export time. This keeps the model independent of zoom and DPI.
 */

export type ToolId =
  | 'select'
  | 'hand'
  | 'text-select'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'ink'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'textbox'
  | 'note'
  | 'stamp'
  | 'image'
  | 'redact'
  | 'whiteout'
  | 'signature'
  | 'form-fill'

/** A rectangle in PDF points, top-left origin. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export interface PageGeometry {
  /** 1-based page number as it currently sits in the document order. */
  index: number
  /** Unrotated media box size in PDF points. */
  width: number
  height: number
  /** View rotation applied on top of the page's own rotation, degrees. */
  rotation: 0 | 90 | 180 | 270
}

export type AnnotationKind =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'ink'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'textbox'
  | 'note'
  | 'stamp'
  | 'image'
  | 'redaction'
  | 'whiteout'
  | 'signature'
  | 'field-value'

export interface BaseAnnotation {
  id: string
  kind: AnnotationKind
  /** Page id (stable across reordering), not page number. */
  pageId: string
  rect: Rect
  rotation?: number
  opacity?: number
  color?: string
  createdAt: number
  updatedAt: number
  author?: string
  locked?: boolean
}

export interface TextMarkupAnnotation extends BaseAnnotation {
  kind: 'highlight' | 'underline' | 'strikeout'
  /** Client rects (PDF points) of the covered glyphs. */
  quads: Rect[]
  note?: string
}

export interface InkAnnotation extends BaseAnnotation {
  kind: 'ink'
  /** One or more strokes; each is a flat [x,y,x,y,...] list in PDF points. */
  strokes: number[][]
  strokeWidth: number
}

export interface ShapeAnnotation extends BaseAnnotation {
  kind: 'rectangle' | 'ellipse' | 'line' | 'arrow'
  strokeWidth: number
  fill?: string
  /** For line/arrow: endpoints in PDF points. */
  start?: Point
  end?: Point
}

export interface TextBoxAnnotation extends BaseAnnotation {
  kind: 'textbox' | 'note'
  text: string
  fontSize: number
  fontFamily: string
  align: 'left' | 'center' | 'right'
  background?: string
  borderColor?: string
}

export interface StampAnnotation extends BaseAnnotation {
  kind: 'stamp'
  label: string
  style: 'approved' | 'draft' | 'confidential' | 'received' | 'custom'
}

export interface ImageAnnotation extends BaseAnnotation {
  kind: 'image' | 'signature'
  /** Object URL / data URL for preview; bytes kept in the asset store. */
  assetId: string
}

export interface RedactionAnnotation extends BaseAnnotation {
  kind: 'redaction' | 'whiteout'
  /** Optional overlay text drawn after the area is cleared. */
  overlayText?: string
}

export interface FieldValueAnnotation extends BaseAnnotation {
  kind: 'field-value'
  fieldName: string
  value: string | boolean
}

export type Annotation =
  | TextMarkupAnnotation
  | InkAnnotation
  | ShapeAnnotation
  | TextBoxAnnotation
  | StampAnnotation
  | ImageAnnotation
  | RedactionAnnotation
  | FieldValueAnnotation

export interface DocPage {
  id: string
  /** Index into the original pdf.js document (0-based); -1 for inserted pages. */
  sourceIndex: number
  width: number
  height: number
  /** Extra view rotation the user applied, added to the page's intrinsic one. */
  userRotation: 0 | 90 | 180 | 270
  deleted?: boolean
}

export interface OutlineNode {
  title: string
  pageIndex: number | null
  children: OutlineNode[]
}

export interface OpenDoc {
  id: string
  name: string
  /** Immutable original bytes as loaded. */
  bytes: Uint8Array
  pageCount: number
  pages: DocPage[]
  outline: OutlineNode[]
  annotations: Record<string, Annotation>
  hasAcroForm: boolean
  /** True once we've OCR'd (or confirmed a real text layer exists). */
  textLayerReady: boolean
  dirty: boolean
  createdAt: number
}

export interface RecentFileMeta {
  id: string
  name: string
  pageCount: number
  openedAt: number
  size: number
  thumbnail?: string
}

export interface SavedSignature {
  id: string
  kind: 'drawn' | 'typed' | 'image'
  /** PNG data URL, transparent background. */
  dataUrl: string
  label?: string
  createdAt: number
}
