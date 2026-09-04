import { useEffect, useState } from 'react'
import { useApp } from '../../state/store'
import type { DocPage } from '../../state/types'
import { getPageProxy } from '../../lib/pdf/registry'
import { getFormFields, type FormField } from '../../lib/pdf/forms'
import { pageTransform, pdfRectToScreen } from '../../lib/pdf/geometry'

interface Props {
  docId: string
  page: DocPage
  scale: number
}

export function FormLayer({ docId, page, scale }: Props) {
  const [fields, setFields] = useState<FormField[]>([])
  const values = useApp((s) =>
    s.docs.find((d) => d.id === docId)?.fieldValues,
  )
  const setFieldValue = useApp((s) => s.setFieldValue)
  const tool = useApp((s) => s.ui.activeTool)
  const interactive = tool === 'select' || tool === 'form-fill'

  useEffect(() => {
    if (page.sourceId == null) return
    let alive = true
    const pp = getPageProxy(docId, page.sourceId, page.sourceIndex)
    pp?.then((proxy) =>
      getFormFields(proxy, page.height).then((f) => alive && setFields(f)),
    )
    return () => {
      alive = false
    }
  }, [docId, page.sourceId, page.sourceIndex, page.height])

  if (!fields.length) return null
  const t = pageTransform(page, scale)

  return (
    <div
      className="absolute inset-0 z-[4]"
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
    >
      {fields.map((f) => {
        if (f.type === 'signature' || f.type === 'button') return null
        const r = pdfRectToScreen(t, f.rect)
        const box: React.CSSProperties = {
          position: 'absolute',
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        }
        const raw = values?.[f.name]
        const highlight = tool === 'form-fill'

        if (f.type === 'checkbox' || f.type === 'radio') {
          const on =
            raw === true ||
            raw === (f.exportValue ?? 'On') ||
            (raw === undefined && f.defaultValue === (f.exportValue ?? 'On'))
          return (
            <button
              key={f.id}
              style={box}
              disabled={f.readOnly}
              onClick={() =>
                setFieldValue(
                  f.name,
                  f.type === 'radio' ? (f.exportValue ?? 'On') : !on,
                )
              }
              className={`grid place-items-center rounded-[2px] border text-accent ${
                highlight ? 'border-accent bg-accent/10' : 'border-transparent'
              }`}
            >
              {on && (
                <svg viewBox="0 0 16 16" className="h-3/4 w-3/4" fill="none">
                  <path
                    d="M3 8l3.5 3.5L13 4"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )
        }

        if (f.type === 'combo' || f.type === 'list') {
          return (
            <select
              key={f.id}
              style={box}
              disabled={f.readOnly}
              value={(raw as string) ?? f.defaultValue}
              onChange={(e) => setFieldValue(f.name, e.target.value)}
              className={`bg-white/90 px-1 text-black outline-none ${
                highlight ? 'ring-1 ring-accent' : ''
              }`}
            >
              <option value="" />
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )
        }

        const Tag = f.multiline ? 'textarea' : 'input'
        return (
          <Tag
            key={f.id}
            style={{
              ...box,
              fontSize: Math.min(r.height * 0.6, 13),
              lineHeight: 1.1,
            }}
            readOnly={f.readOnly}
            maxLength={f.maxLen}
            value={(raw as string) ?? f.defaultValue}
            onChange={(e) =>
              setFieldValue(f.name, (e.target as HTMLInputElement).value)
            }
            className={`resize-none bg-accent/5 px-1 text-black caret-accent outline-none ${
              highlight
                ? 'ring-1 ring-accent placeholder:text-accent/50'
                : 'ring-0'
            } focus:bg-accent/10 focus:ring-1 focus:ring-accent`}
          />
        )
      })}
    </div>
  )
}
