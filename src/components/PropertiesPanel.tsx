import { useApp } from '../state/store'
import type { OpenDoc } from '../state/types'

export function PropertiesPanel({ doc }: { doc: OpenDoc }) {
  const selectedIds = useApp((s) => s.ui.selectedIds)
  const sel = selectedIds
    .map((id) => doc.annotations[id])
    .filter(Boolean)

  return (
    <div className="chrome-scroll h-full w-64 shrink-0 overflow-y-auto border-l border-chrome-line bg-ink px-3 py-3 text-sm">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
        {sel.length ? 'Selection' : 'Document'}
      </div>

      {sel.length === 0 ? (
        <dl className="space-y-1.5 text-chrome-muted">
          <div className="flex justify-between">
            <dt>Pages</dt>
            <dd className="text-chrome-text">{doc.pages.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Form fields</dt>
            <dd className="text-chrome-text">{doc.hasAcroForm ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Text layer</dt>
            <dd className="text-chrome-text">
              {doc.textLayerReady ? 'Present' : 'Scanned / none'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Annotations</dt>
            <dd className="text-chrome-text">
              {Object.keys(doc.annotations).length}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-2 text-chrome-muted">
          <div>
            {sel.length} item{sel.length > 1 ? 's' : ''} selected
          </div>
          <div className="text-xs">
            {Array.from(new Set(sel.map((a) => a.kind))).join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}
