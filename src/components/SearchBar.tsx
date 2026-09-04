import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/store'
import { getPageProxy } from '../lib/pdf/registry'
import type { OpenDoc } from '../state/types'
import { IconChevronDown, IconChevronRight, IconX } from './icons'

interface Hit {
  pageNumber: number
  snippet: string
}

export function SearchBar({ doc }: { doc: OpenDoc }) {
  const setSearch = useApp((s) => s.setSearch)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const runId = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const id = ++runId.current
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    setBusy(true)
    const needle = q.toLowerCase()
    const t = setTimeout(async () => {
      const found: Hit[] = []
      for (let i = 0; i < doc.pages.length; i++) {
        if (id !== runId.current) return
        const pg = doc.pages[i]
        const pp = getPageProxy(doc.id, pg.sourceId, pg.sourceIndex)
        if (!pp) continue
        const page = await pp
        const tc = await page.getTextContent()
        const text = tc.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
        const lc = text.toLowerCase()
        let from = 0
        while (true) {
          const at = lc.indexOf(needle, from)
          if (at < 0) break
          found.push({
            pageNumber: i + 1,
            snippet: text.slice(Math.max(0, at - 30), at + needle.length + 30),
          })
          from = at + needle.length
        }
      }
      if (id === runId.current) {
        setHits(found)
        setActive(0)
        setBusy(false)
        if (found[0]) go(found[0].pageNumber)
      }
    }, 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, doc.id])

  const go = (pageNumber: number) => {
    const node = document.querySelector<HTMLElement>(
      `[data-page="${pageNumber}"]`,
    )
    const scroller = node?.closest('.chrome-scroll') as HTMLElement | null
    if (node && scroller)
      scroller.scrollTo({ top: node.offsetTop - 24, behavior: 'smooth' })
  }

  const step = (dir: 1 | -1) => {
    if (!hits.length) return
    const next = (active + dir + hits.length) % hits.length
    setActive(next)
    go(hits[next].pageNumber)
  }

  return (
    <div className="absolute right-4 top-3 z-30 w-[340px] rounded-lg border border-chrome-line bg-ink-2/95 p-2 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
            if (e.key === 'Escape') setSearch(false)
          }}
          placeholder="Find in document"
          className="h-8 flex-1 rounded-md border border-chrome-line bg-ink px-2.5 text-sm text-chrome-text outline-none placeholder:text-chrome-muted focus:border-accent"
        />
        <span className="min-w-[54px] text-center text-xs text-chrome-muted">
          {busy ? '…' : hits.length ? `${active + 1}/${hits.length}` : '0'}
        </span>
        <button
          className="rounded p-1.5 text-chrome-muted hover:bg-white/10"
          onClick={() => step(-1)}
        >
          <IconChevronDown width={15} height={15} className="rotate-180" />
        </button>
        <button
          className="rounded p-1.5 text-chrome-muted hover:bg-white/10"
          onClick={() => step(1)}
        >
          <IconChevronDown width={15} height={15} />
        </button>
        <button
          className="rounded p-1.5 text-chrome-muted hover:bg-white/10"
          onClick={() => setSearch(false)}
        >
          <IconX width={15} height={15} />
        </button>
      </div>
      {hits.length > 0 && (
        <ul className="chrome-scroll mt-2 max-h-48 overflow-y-auto text-xs">
          {hits.slice(0, 40).map((h, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  setActive(i)
                  go(h.pageNumber)
                }}
                className={`flex w-full gap-2 rounded px-2 py-1.5 text-left ${
                  i === active ? 'bg-accent/15' : 'hover:bg-white/5'
                }`}
              >
                <span className="shrink-0 text-chrome-muted">
                  p.{h.pageNumber}
                </span>
                <span className="truncate text-chrome-text">…{h.snippet}…</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!doc.textLayerReady && (
        <p className="mt-2 flex items-center gap-1 px-1 text-[11px] text-amber-300/80">
          <IconChevronRight width={12} height={12} />
          This looks like a scanned document. Run OCR to make it searchable.
        </p>
      )}
    </div>
  )
}
