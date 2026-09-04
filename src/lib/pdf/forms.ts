/** Read AcroForm widget annotations from a pdf.js page. */
import type { PDFPageProxy } from './pdfjs'
import type { Rect } from '../../state/types'

export interface FormField {
  id: string
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'combo' | 'list' | 'signature' | 'button'
  /** Rect in unrotated PDF points, top-left origin. */
  rect: Rect
  defaultValue: string
  readOnly: boolean
  multiline: boolean
  options: { value: string; label: string }[]
  /** For radio/checkbox: the "on" state name for this widget. */
  exportValue?: string
  maxLen?: number
}

interface RawAnnot {
  id: string
  subtype: string
  fieldType?: string
  fieldName?: string
  rect: number[]
  fieldValue?: string | string[]
  defaultFieldValue?: string
  readOnly?: boolean
  multiLine?: boolean
  comb?: boolean
  options?: { exportValue?: string; displayValue?: string }[]
  checkBox?: boolean
  radioButton?: boolean
  exportValue?: string
  buttonValue?: string
  maxLen?: number
}

export async function getFormFields(
  page: PDFPageProxy,
  pageHeight: number,
): Promise<FormField[]> {
  const annots = (await page.getAnnotations({
    intent: 'display',
  })) as RawAnnot[]
  const out: FormField[] = []
  for (const a of annots) {
    if (a.subtype !== 'Widget' || !a.fieldName) continue
    const [x1, y1, x2, y2] = a.rect
    // pdf.js rect is [llx, lly, urx, ury] bottom-left origin -> flip to top-left
    const rect: Rect = {
      x: Math.min(x1, x2),
      y: pageHeight - Math.max(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    }
    let type: FormField['type'] = 'text'
    if (a.fieldType === 'Tx') type = 'text'
    else if (a.fieldType === 'Btn')
      type = a.checkBox ? 'checkbox' : a.radioButton ? 'radio' : 'button'
    else if (a.fieldType === 'Ch') type = a.comb ? 'combo' : 'combo'
    else if (a.fieldType === 'Sig') type = 'signature'

    out.push({
      id: a.id,
      name: a.fieldName,
      type,
      rect,
      defaultValue:
        (Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue) ??
        a.defaultFieldValue ??
        '',
      readOnly: !!a.readOnly,
      multiline: !!a.multiLine,
      options: (a.options ?? []).map((o) => ({
        value: o.exportValue ?? o.displayValue ?? '',
        label: o.displayValue ?? o.exportValue ?? '',
      })),
      exportValue: a.exportValue ?? a.buttonValue,
      maxLen: a.maxLen,
    })
  }
  return out
}
