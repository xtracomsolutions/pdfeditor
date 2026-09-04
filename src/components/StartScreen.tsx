import { useEffect, useState } from 'react'
import { useOpenFiles } from '../lib/useOpenFiles'
import { listRecents, type RecentRecord } from '../lib/storage/db'
import {
  discardAllSessions,
  listRecoverable,
  restoreSession,
  type RecoverableSession,
} from '../lib/useAutosave'
import { IconPlus, IconRotate, IconX } from './icons'

export function StartScreen() {
  const { pickFiles } = useOpenFiles()
  const [recents, setRecents] = useState<RecentRecord[]>([])
  const [recover, setRecover] = useState<RecoverableSession[]>([])

  useEffect(() => {
    void listRecents().then(setRecents)
    void listRecoverable().then(setRecover)
  }, [])

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-ink-2 px-6">
      {/* faint brand grid, echoing the website hero */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 60% at 80% 10%, rgba(75,175,214,.18), transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">
        <img
          src="/brand/emblem.jpg"
          alt=""
          className="mx-auto mb-6 h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10"
        />
        <h1 className="font-display text-2xl font-bold text-chrome-text">
          Redline
        </h1>
        <p className="mt-2 text-sm text-chrome-muted">
          Read, mark up, fill, sign and redact PDFs. Everything stays on this
          device — no upload, no account.
        </p>

        <button
          onClick={pickFiles}
          className="mx-auto mt-7 flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-display text-sm font-semibold text-white shadow-[0_8px_24px_rgba(75,175,214,0.35)] transition hover:bg-accent-dark"
        >
          <IconPlus width={17} height={17} />
          Open a PDF
        </button>
        <p className="mt-3 text-xs text-chrome-muted">
          or drop files anywhere in this window
        </p>

        {recover.length > 0 && (
          <div className="mt-8 rounded-lg border border-accent/40 bg-accent/10 p-3 text-left">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                <IconRotate width={13} height={13} />
                Unsaved work from last session
              </span>
              <button
                onClick={() => {
                  void discardAllSessions()
                  setRecover([])
                }}
                className="rounded p-0.5 text-chrome-muted hover:bg-white/10"
                title="Discard"
              >
                <IconX width={13} height={13} />
              </button>
            </div>
            <ul className="space-y-1">
              {recover.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={async () => {
                      await restoreSession(r.id)
                      setRecover((s) => s.filter((x) => x.id !== r.id))
                    }}
                    className="flex w-full items-center justify-between rounded-md bg-ink/50 px-3 py-2 text-sm hover:bg-ink"
                  >
                    <span className="truncate text-chrome-text">{r.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-chrome-muted">
                      {r.pageCount} pp · {new Date(r.savedAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recents.length > 0 && (
          <div className="mt-10 text-left">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-chrome-muted">
              Recent
            </div>
            <ul className="divide-y divide-chrome-line/60 rounded-lg border border-chrome-line bg-ink/60">
              {recents.slice(0, 6).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="truncate text-chrome-text">{r.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-chrome-muted">
                    {r.pageCount} pp · {(r.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-chrome-muted">
              Recent files are remembered by name only — reopen them from disk.
            </p>
          </div>
        )}
      </div>

      <footer className="relative z-10 mt-12 text-[11px] text-chrome-muted">
        Xtracom Solutions · Building secure &amp; connected spaces
      </footer>
    </div>
  )
}
