import { useState } from 'react'
import type { OpenDoc, OutlineNode } from '../state/types'
import { IconChevronDown, IconChevronRight } from './icons'

function scrollToPage(index0: number) {
  const n = index0 + 1
  const node = document.querySelector<HTMLElement>(`[data-page="${n}"]`)
  const scroller = node?.closest('.chrome-scroll') as HTMLElement | null
  if (node && scroller)
    scroller.scrollTo({ top: node.offsetTop - 24, behavior: 'smooth' })
}

function Node({ node, depth }: { node: OutlineNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1)
  const hasKids = node.children.length > 0
  return (
    <li>
      <div
        className="flex items-center gap-1 rounded px-1 py-1 text-sm text-chrome-muted hover:bg-white/5 hover:text-chrome-text"
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {hasKids ? (
          <button onClick={() => setOpen(!open)} className="shrink-0">
            {open ? (
              <IconChevronDown width={14} height={14} />
            ) : (
              <IconChevronRight width={14} height={14} />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <button
          className="flex-1 truncate text-left"
          onClick={() =>
            node.pageIndex != null && scrollToPage(node.pageIndex)
          }
          title={node.title}
        >
          {node.title}
        </button>
      </div>
      {hasKids && open && (
        <ul>
          {node.children.map((c, i) => (
            <Node key={i} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OutlinePanel({ doc }: { doc: OpenDoc }) {
  return (
    <div className="chrome-scroll h-full w-64 shrink-0 overflow-y-auto border-r border-chrome-line bg-ink px-2 py-3">
      <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
        Outline
      </div>
      {doc.outline.length === 0 ? (
        <p className="px-2 text-xs text-chrome-muted">
          This document has no bookmarks.
        </p>
      ) : (
        <ul>
          {doc.outline.map((n, i) => (
            <Node key={i} node={n} depth={0} />
          ))}
        </ul>
      )}
    </div>
  )
}
